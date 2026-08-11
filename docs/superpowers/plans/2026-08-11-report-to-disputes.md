# Report → Disputes API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client-only "Signaler un problème" form with a real backend flow: a new `Dispute`-backed API (the Prisma model already exists) and a parcel-scoped mobile screen that opens/reads it.

**Architecture:** A new Fastify route file `packages/api/src/routes/disputes.ts` reuses the existing `assertParcelParticipant` participant/role resolver from `lib/chat-access.ts` (same helper `chat.ts` already uses) for authorization, and the existing `notify()` helper for counterparty alerts. On the mobile side, `app/report.tsx` becomes `app/report/[parcelId].tsx`, gains a `lib/disputes.ts` API wrapper (mirroring `lib/kyc.ts`'s shape), and its entry point moves from the generic Settings menu into the shared `parcel/[id].tsx` detail screen — the same screen both the sender and the matched traveler already land on for a given parcel.

**Tech Stack:** Fastify 5 + Zod (backend), Prisma (`@crowdshipping/db`), Expo Router + NativeWind + Zustand (mobile), Node's built-in `node:test` + `node:assert/strict` for backend tests.

## Global Constraints

- All money/currency is EUR-only in v1 (unaffected by this plan — no money fields here).
- Backend routes use Fastify + Zod validation, `app.authenticate` preHandler, and the `prisma` singleton from `@crowdshipping/db` — follow `kyc.ts`/`chat.ts` conventions exactly.
- Mobile screens use the existing `Screen`/`ScreenHeader`/`Card`/`Button`/`Select`/`Input`/`StatusPill` components and `useAsync` hook — do not create new primitives.
- No admin moderation queue, no evidence/photo upload, no guard blocking other parcel actions while `DISPUTED` — all explicitly out of scope per the approved spec (`docs/superpowers/specs/2026-08-11-report-to-disputes-design.md`).
- Mobile has no test suite; verification is `pnpm --filter @crowdshipping/mobile typecheck`. Backend verification is `pnpm --filter @crowdshipping/api test` (runs `node --import tsx --test src/test/*.test.ts`).
- French UI copy throughout (this app is French-first per the recently adapted design).

---

## Correction vs. the approved spec

The spec (`2026-08-11-report-to-disputes-design.md`) called for adding the report entry point to **both** `parcel/[id].tsx` and `trip/[id].tsx`. Reading `trip/[id].tsx` during planning showed this is unnecessary: a traveler viewing one of their accepted parcels already navigates to `parcel/[id].tsx` (see `trip/[id].tsx`'s parcel list: `onPress={() => router.push(\`/parcel/${p.id}\`)}`) — there is no separate traveler-side parcel view. `parcel/[id].tsx` is the one shared detail screen for both roles (confirmed via `GET /parcels/:id` in `packages/api/src/routes/parcels.ts`, which has no sender-only restriction). Task 5 below therefore only touches `parcel/[id].tsx`.

---

### Task 1: Add the `DISPUTE_OPENED` notification type + template

**Files:**
- Modify: `packages/api/src/lib/notifications.ts`
- Modify: `packages/api/src/test/notifications.test.ts`

**Interfaces:**
- Produces: `NotificationType` union gains `"DISPUTE_OPENED"`; `NotificationPayload` gains `disputeReason?: string`; `TEMPLATES.DISPUTE_OPENED` renders `{title, body}`.

- [ ] **Step 1: Add the type + payload field**

In `packages/api/src/lib/notifications.ts`, extend the `NotificationType` union (currently ends `| "KYC_REJECTED";`):

```ts
export type NotificationType =
  | "MATCH_FOUND"
  | "PARCEL_PICKED_UP"
  | "IN_TRANSIT"
  | "AWAITING_DELIVERY"
  | "DELIVERED"
  | "PAYOUT_SENT"
  | "ESCROW_FUNDED"
  | "ESCROW_REFUNDED"
  | "CHAT_MESSAGE"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "DISPUTE_OPENED";
```

And add a field to `NotificationPayload` (right after `reviewNote?: string;`):

```ts
  reviewNote?: string;
  disputeReason?: string;
```

- [ ] **Step 2: Add the template**

In the same file, add to `TEMPLATES` right after the `KYC_REJECTED` entry (before the closing `};`):

```ts
  DISPUTE_OPENED: (p) => ({
    title: "Litige ouvert ⚠️",
    body: p.disputeReason
      ? `Un signalement a été ouvert pour votre colis (motif : ${p.disputeReason}).`
      : "Un signalement a été ouvert pour votre colis.",
  }),
```

- [ ] **Step 3: Extend the template test**

In `packages/api/src/test/notifications.test.ts`, add `"DISPUTE_OPENED"` to the `types` array (currently ends `"KYC_APPROVED", "KYC_REJECTED",`):

```ts
  const types: NotificationType[] = [
    "MATCH_FOUND", "PARCEL_PICKED_UP", "IN_TRANSIT", "AWAITING_DELIVERY",
    "DELIVERED", "PAYOUT_SENT", "ESCROW_FUNDED", "ESCROW_REFUNDED",
    "CHAT_MESSAGE", "KYC_APPROVED", "KYC_REJECTED", "DISPUTE_OPENED",
  ];
```

And add `disputeReason: "Colis endommagé"` to the payload object passed in the loop (currently ends `reviewNote: "Document illisible",`):

```ts
      const { title, body } = renderMessage(type, {
        travelerName: "Ahmed",
        amount: 30,
        currency: "EUR",
        senderName: "Karim",
        chatPreview: "Bonjour",
        kycLevel: "ENHANCED",
        reviewNote: "Document illisible",
        disputeReason: "Colis endommagé",
      });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @crowdshipping/api test`
Expected: PASS, including a new `renders a non-empty {title, body} for DISPUTE_OPENED` case.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/notifications.ts packages/api/src/test/notifications.test.ts
git commit -m "feat(api): add DISPUTE_OPENED notification type"
```

---

### Task 2: Add `counterpartyOf` helper to chat-access.ts

**Files:**
- Modify: `packages/api/src/lib/chat-access.ts`
- Modify: `packages/api/src/test/chat-access.test.ts`

**Interfaces:**
- Consumes: `ParcelParticipant` (existing, from `assertParcelParticipant`'s return type).
- Produces: `counterpartyOf(p: ParcelParticipant): string | null` — used by Task 3's `disputes.ts`.

- [ ] **Step 1: Write the failing tests**

In `packages/api/src/test/chat-access.test.ts`, add this import to the existing import block (currently `assertParcelParticipant, HttpError`):

```ts
import {
  assertParcelParticipant,
  counterpartyOf,
  HttpError,
} from "../lib/chat-access.js";
```

Then append this new `describe` block at the end of the file, before the final `console.log("chat-access tests: done");` line:

```ts
describe("counterpartyOf", () => {
  it("returns the traveler when the caller is the sender", () => {
    const id = counterpartyOf({
      parcelId: "p1",
      senderId: "u1",
      travelerId: "u2",
      role: "SENDER",
    });
    assert.strictEqual(id, "u2");
  });

  it("returns the sender when the caller is the traveler", () => {
    const id = counterpartyOf({
      parcelId: "p1",
      senderId: "u1",
      travelerId: "u2",
      role: "TRAVELER",
    });
    assert.strictEqual(id, "u1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @crowdshipping/api test`
Expected: FAIL with a TypeScript/import error — `counterpartyOf` is not exported from `../lib/chat-access.js` yet.

- [ ] **Step 3: Implement the helper**

In `packages/api/src/lib/chat-access.ts`, append this function at the end of the file (after `assertParcelParticipant`):

```ts
/**
 * The other party on a parcel thread, given the caller's resolved role.
 * Shared by chat and disputes so "who's the counterparty" can't drift.
 */
export function counterpartyOf(p: ParcelParticipant): string | null {
  return p.role === "SENDER" ? p.travelerId : p.senderId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @crowdshipping/api test`
Expected: PASS, including the two new `counterpartyOf` cases.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/chat-access.ts packages/api/src/test/chat-access.test.ts
git commit -m "feat(api): add counterpartyOf helper, shared by chat and disputes"
```

---

### Task 3: `disputes.ts` route (POST /disputes, GET /disputes/:parcelId)

**Files:**
- Create: `packages/api/src/routes/disputes.ts`
- Modify: `packages/api/src/server.ts`

**Interfaces:**
- Consumes: `assertParcelParticipant`, `HttpError` from `../lib/chat-access.js` (Task 2 also adds `counterpartyOf` here); `notify` from `../lib/notifications.js` (Task 1's `"DISPUTE_OPENED"` type); `prisma` from `@crowdshipping/db` (`prisma.dispute`, `prisma.parcel`).
- Produces: `disputeRoutes: FastifyPluginAsync`, registered at prefix `/disputes`. `POST /disputes` body `{ parcelId, reason, description }` → `201 { dispute }` or `403`/`404`/`409`/`400`. `GET /disputes/:parcelId` → `{ dispute: Dispute | null }` or `403`/`404`.

- [ ] **Step 1: Write the route file**

Create `packages/api/src/routes/disputes.ts`:

```ts
/**
 * Disputes — sender/traveler-initiated reports on a parcel.
 *
 * One dispute per parcel (Dispute.parcelId is unique in the schema).
 * Opening a dispute moves the parcel to DISPUTED and notifies the other
 * party. v1 scope is open + read only — an admin moderation queue (mirroring
 * kyc.ts's /admin/pending pattern) is a separate future phase, and no other
 * route currently guards against acting on a DISPUTED parcel (escrow release,
 * delivery confirmation, etc. still work normally). That's a known, explicit
 * gap — not an oversight.
 *
 * Endpoints:
 *   POST /disputes            open a dispute (authenticated, participant only)
 *   GET  /disputes/:parcelId  read the dispute for a parcel (participants only)
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma } from "@crowdshipping/db";
import { assertParcelParticipant, counterpartyOf, HttpError } from "../lib/chat-access.js";
import { notify } from "../lib/notifications.js";

const DISPUTE_REASONS = [
  "PARCEL_NOT_DELIVERED",
  "PARCEL_DAMAGED",
  "PARCEL_STOLEN",
  "CUSTOMS_SEIZURE",
  "TRAVELER_NO_SHOW",
  "SENDER_NO_SHOW",
  "FRAUD_ATTEMPT",
  "OTHER",
] as const;

/** French label per reason, used only for the notification text sent to the counterparty. */
const DISPUTE_REASON_LABEL_FR: Record<(typeof DISPUTE_REASONS)[number], string> = {
  PARCEL_NOT_DELIVERED: "Colis non livré",
  PARCEL_DAMAGED: "Colis endommagé",
  PARCEL_STOLEN: "Colis volé",
  CUSTOMS_SEIZURE: "Saisie en douane",
  TRAVELER_NO_SHOW: "Le voyageur n'est jamais venu",
  SENDER_NO_SHOW: "L'expéditeur n'est jamais venu",
  FRAUD_ATTEMPT: "Tentative de fraude",
  OTHER: "Autre",
};

const openSchema = z.object({
  parcelId: z.string().min(1),
  reason: z.enum(DISPUTE_REASONS),
  description: z.string().min(1).max(2000),
});

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;

function sendHttpError(reply: FastifyReply, err: unknown) {
  if (err instanceof HttpError) {
    return reply.code(err.status).send({ error: err.message });
  }
  reply.code(500).send({ error: "Internal error" });
}

export const disputeRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /disputes — open a dispute ─────────────────────────────────
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = openSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { parcelId, reason, description } = parsed.data;
      const userId = req.user.sub;

      let participant;
      try {
        participant = await assertParcelParticipant(parcelId, userId);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      const existing = await prisma.dispute.findUnique({
        where: { parcelId },
        select: { id: true },
      });
      if (existing) {
        return reply.code(409).send({
          error: "A dispute already exists for this parcel",
          disputeId: existing.id,
        });
      }

      const now = new Date();
      const dispute = await prisma.dispute.create({
        data: {
          parcelId,
          openedById: userId,
          reason,
          description,
          status: "OPENED",
          mustResolveBy: new Date(now.getTime() + SEVENTY_TWO_HOURS_MS),
        },
      });

      await prisma.parcel.update({
        where: { id: parcelId },
        data: { status: "DISPUTED" },
      });

      const counterpartyId = counterpartyOf(participant);
      if (counterpartyId) {
        notify(counterpartyId, "DISPUTE_OPENED", {
          parcelId,
          disputeReason: DISPUTE_REASON_LABEL_FR[reason],
        }).catch(() => { /* provider errors logged inside notify() */ });
      }

      app.log.info(
        { disputeId: dispute.id, parcelId, openedById: userId, reason },
        "Dispute opened",
      );

      return reply.code(201).send({ dispute });
    },
  );

  // ── GET /disputes/:parcelId — read the dispute for a parcel ────────
  app.get(
    "/:parcelId",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const { parcelId } = req.params as { parcelId: string };
      try {
        await assertParcelParticipant(parcelId, req.user.sub);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      const dispute = await prisma.dispute.findUnique({ where: { parcelId } });
      return { dispute };
    },
  );
};
```

- [ ] **Step 2: Register the route in server.ts**

In `packages/api/src/server.ts`, add the import after `import { kycRoutes } from "./routes/kyc.js";`:

```ts
import { kycRoutes } from "./routes/kyc.js";
import { disputeRoutes } from "./routes/disputes.js";
```

And register it after `await app.register(kycRoutes, { prefix: "/kyc" });`:

```ts
  await app.register(kycRoutes, { prefix: "/kyc" });
  await app.register(disputeRoutes, { prefix: "/disputes" });
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @crowdshipping/api typecheck`
Expected: PASS, no type errors.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm --filter @crowdshipping/api test`
Expected: PASS (this task adds no new test file — Tasks 1 and 2 already cover the pure logic this route depends on; the route itself follows the same authorization/notification pattern as `chat.ts`, which has no route-level test either).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/disputes.ts packages/api/src/server.ts
git commit -m "feat(api): add POST/GET /disputes routes"
```

---

### Task 4: Mobile `lib/disputes.ts` API wrapper + shared type/label additions

**Files:**
- Create: `apps/mobile/src/lib/disputes.ts`
- Modify: `apps/mobile/src/lib/types.ts`
- Modify: `apps/mobile/src/lib/format.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./api` (existing).
- Produces: `DisputeReason`, `DisputeStatus` types (in `types.ts`); `DISPUTE_REASON_LABEL`, `DISPUTE_STATUS` maps (in `format.ts`); `openDispute(input): Promise<{ dispute: Dispute }>`, `getDispute(parcelId): Promise<{ dispute: Dispute | null }>`, `type Dispute`, `type DisputeReason` re-export (in `lib/disputes.ts`) — consumed by Task 5.

- [ ] **Step 1: Add the enum types**

In `apps/mobile/src/lib/types.ts`, add after the existing `export type ParcelStatus = ...;` block (right before `export type TripStatus = ...`):

```ts
export type DisputeReason =
  | "PARCEL_NOT_DELIVERED"
  | "PARCEL_DAMAGED"
  | "PARCEL_STOLEN"
  | "CUSTOMS_SEIZURE"
  | "TRAVELER_NO_SHOW"
  | "SENDER_NO_SHOW"
  | "FRAUD_ATTEMPT"
  | "OTHER";

export type DisputeStatus = "OPENED" | "MEDIATING" | "ESCALATED" | "RESOLVED" | "CLOSED";
```

- [ ] **Step 2: Add French labels**

In `apps/mobile/src/lib/format.ts`, add the import of the new types to the existing `import type { ... } from "./types";` block (add `DisputeReason, DisputeStatus,` alphabetically):

```ts
import type {
  DisputeReason,
  DisputeStatus,
  EscrowStatus,
  KycLevel,
  ParcelCategory,
  TransportMode,
  TripStatus,
  UrgencyLevel,
} from "./types";
```

Then add these two maps after the existing `KYC_LEVEL` map (right before `export const MODE_LABEL`):

```ts
export const DISPUTE_REASON_LABEL: Record<DisputeReason, string> = {
  PARCEL_NOT_DELIVERED: "Colis non livré",
  PARCEL_DAMAGED: "Colis endommagé",
  PARCEL_STOLEN: "Colis volé",
  CUSTOMS_SEIZURE: "Saisie en douane",
  TRAVELER_NO_SHOW: "Le voyageur n'est jamais venu",
  SENDER_NO_SHOW: "L'expéditeur n'est jamais venu",
  FRAUD_ATTEMPT: "Tentative de fraude",
  OTHER: "Autre",
};

export const DISPUTE_STATUS: Record<DisputeStatus, { label: string; tone: Tone }> = {
  OPENED: { label: "Ouvert", tone: "danger" },
  MEDIATING: { label: "En médiation", tone: "accent" },
  ESCALATED: { label: "Escaladé", tone: "danger" },
  RESOLVED: { label: "Résolu", tone: "success" },
  CLOSED: { label: "Clos", tone: "muted" },
};
```

- [ ] **Step 3: Write the API wrapper**

Create `apps/mobile/src/lib/disputes.ts`:

```ts
/**
 * Disputes API — typed wrappers over /disputes.
 *
 * Mirrors packages/api/src/routes/disputes.ts. One dispute per parcel: once
 * GET returns non-null, the report screen shows a read-only view instead of
 * the form.
 */
import { apiFetch } from "./api";
import type { DisputeReason, DisputeStatus } from "./types";

export interface Dispute {
  id: string;
  parcelId: string;
  openedById: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  mustResolveBy: string;
  createdAt: string;
}

export interface OpenDisputeInput {
  parcelId: string;
  reason: DisputeReason;
  description: string;
}

export function openDispute(input: OpenDisputeInput): Promise<{ dispute: Dispute }> {
  return apiFetch("/disputes", { method: "POST", body: input });
}

export function getDispute(parcelId: string): Promise<{ dispute: Dispute | null }> {
  return apiFetch(`/disputes/${parcelId}`);
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS, no type errors (the file isn't imported anywhere yet, but must still compile standalone).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/disputes.ts apps/mobile/src/lib/types.ts apps/mobile/src/lib/format.ts
git commit -m "feat(mobile): add disputes API wrapper + French labels"
```

---

### Task 5: `report/[parcelId].tsx` screen (role-filtered form + read-only state)

**Files:**
- Create: `apps/mobile/app/report/[parcelId].tsx`
- Delete: `apps/mobile/app/report.tsx`

**Interfaces:**
- Consumes: `openDispute`, `getDispute`, `type Dispute` from `../../src/lib/disputes` (Task 4); `DISPUTE_REASON_LABEL`, `DISPUTE_STATUS`, `formatDateTime` from `../../src/lib/format`; `useAsync` from `../../src/hooks/useAsync`; `useAuth` from `../../src/store/auth`; `ApiError` from `../../src/lib/api`.
- Produces: default-exported `ReportScreen`, routed at `/report/[parcelId]`, reading a `role: "sender" | "traveler"` query param the caller supplies (Task 6 passes it).

- [ ] **Step 1: Write the new screen**

Create `apps/mobile/app/report/[parcelId].tsx`:

```tsx
/**
 * Report an issue (board 13) — opens a Dispute for a specific parcel.
 *
 * Reasons are filtered by the caller's role: a sender never sees "the
 * sender never showed up" as an option, and vice versa for the traveler.
 * If a dispute already exists for this parcel, shows it read-only instead
 * of the form (Dispute.parcelId is unique — one report per parcel).
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { StatusPill } from "../../src/components/StatusPill";
import { Input } from "../../src/components/Input";
import { Select, type SelectOption } from "../../src/components/Select";
import { Button } from "../../src/components/Button";
import { useAsync } from "../../src/hooks/useAsync";
import { getDispute, openDispute, type Dispute } from "../../src/lib/disputes";
import { ApiError } from "../../src/lib/api";
import { DISPUTE_REASON_LABEL, DISPUTE_STATUS, formatDateTime } from "../../src/lib/format";
import type { DisputeReason } from "../../src/lib/types";

const SHARED_REASONS: DisputeReason[] = [
  "PARCEL_NOT_DELIVERED",
  "PARCEL_DAMAGED",
  "PARCEL_STOLEN",
  "CUSTOMS_SEIZURE",
  "FRAUD_ATTEMPT",
  "OTHER",
];

function reasonsFor(role: "sender" | "traveler"): SelectOption[] {
  const roleSpecific: DisputeReason = role === "sender" ? "TRAVELER_NO_SHOW" : "SENDER_NO_SHOW";
  return [...SHARED_REASONS, roleSpecific].map((value) => ({
    value,
    label: DISPUTE_REASON_LABEL[value],
  }));
}

export default function ReportScreen() {
  const { parcelId, role } = useLocalSearchParams<{
    parcelId: string;
    role: "sender" | "traveler";
  }>();
  const { data, loading, error, setData } = useAsync(() => getDispute(parcelId), [parcelId]);
  const [reason, setReason] = useState<DisputeReason | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existing = data?.dispute ?? null;

  async function submit() {
    if (!reason) {
      Alert.alert("Champ manquant", "Choisissez un motif.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Champ manquant", "Décrivez ce qui s'est passé.");
      return;
    }
    setSubmitting(true);
    try {
      const { dispute } = await openDispute({ parcelId, reason, description });
      setData({ dispute });
      Alert.alert(
        "Signalement envoyé",
        "Merci. Notre équipe examine votre signalement. Pour les urgences, contactez le support.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // Race: someone opened a dispute for this parcel between our GET and this POST.
        const { dispute } = await getDispute(parcelId);
        setData({ dispute });
      } else {
        Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Signaler un problème" />

      {loading ? <Text className="text-muted">Chargement…</Text> : null}
      {error ? <Text className="text-danger">{error}</Text> : null}

      {!loading && !error && existing ? (
        <DisputeReadOnly dispute={existing} />
      ) : null}

      {!loading && !error && !existing ? (
        <View className="gap-md">
          <Select
            label="Motif"
            value={reason || null}
            options={reasonsFor(role)}
            onSelect={(v) => setReason(v as DisputeReason)}
            placeholder="Choisir un motif"
          />
          <Input
            label="Détails"
            value={description}
            onChangeText={setDescription}
            placeholder="Décrivez ce qui s'est passé…"
            multiline
            className="h-28"
          />
          <Button label="Envoyer le signalement" onPress={submit} loading={submitting} />
        </View>
      ) : null}
    </Screen>
  );
}

function DisputeReadOnly({ dispute }: { dispute: Dispute }) {
  const st = DISPUTE_STATUS[dispute.status];
  return (
    <Card className="gap-2">
      <StatusPill label={st.label} tone={st.tone} />
      <Text className="text-white font-body font-semibold mt-1">
        {DISPUTE_REASON_LABEL[dispute.reason]}
      </Text>
      <Text className="text-muted font-body text-sm">{dispute.description}</Text>
      <Text className="text-mist/50 font-body text-xs mt-2">
        Signalé le {formatDateTime(dispute.createdAt)}
      </Text>
    </Card>
  );
}
```

- [ ] **Step 2: Delete the old screen**

```bash
git rm apps/mobile/app/report.tsx
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/report/[parcelId].tsx
git commit -m "feat(mobile): replace client-only report form with disputes-backed screen"
```

---

### Task 6: Wire the entry point into parcel/[id].tsx, remove it from Settings

**Files:**
- Modify: `apps/mobile/app/parcel/[id].tsx`
- Modify: `apps/mobile/app/settings.tsx`

**Interfaces:**
- Consumes: `useAuth` from `../../src/store/auth` (existing, already used the same way in `trip/[id].tsx`); navigates to `/report/[parcelId]?role=...` (Task 5's screen).

- [ ] **Step 1: Add role detection + the button in parcel/[id].tsx**

In `apps/mobile/app/parcel/[id].tsx`, add the `useAuth` import alongside the existing imports (after `import { Avatar } from "../../src/components/Avatar";`):

```ts
import { Avatar } from "../../src/components/Avatar";
import { useAuth } from "../../src/store/auth";
```

Inside `ParcelDetailScreen`, right after the existing `const { data, loading, error, refresh, setData } = useAsync(...)` line, add:

```ts
  const user = useAuth((s) => s.user);
```

After the existing `const canCancel = [...]` line (still before the early `if (loading...)`/`if (error...)` returns — no, those returns are *above* this point already; place it right after `canCancel`, still within the function body before the final `return (`):

```ts
  const canCancel = ["DRAFT", "PENDING_MATCH", "MATCHED"].includes(parcel.status);
  const isTraveler = !!user && parcel.matchedTrip?.traveler?.id === user.id;
  const canReport = matched && (isTraveler || parcel.senderId === user?.id);
```

Then, in the "Actions" `View` block, add the report button right after the `canCancel` button (after the closing `) : null}` of the "Annuler ce colis" button, still inside the same `<View className="gap-md mt-lg">`):

```tsx
          {canCancel ? (
            <Button label="Annuler ce colis" variant="ghost" onPress={onCancel} loading={busy} />
          ) : null}
          {canReport ? (
            <Button
              label="Signaler un problème"
              variant="ghost"
              onPress={() =>
                router.push(
                  `/report/${parcel.id}?role=${isTraveler ? "traveler" : "sender"}`,
                )
              }
            />
          ) : null}
```

- [ ] **Step 2: Remove the generic entry from Settings**

In `apps/mobile/app/settings.tsx`, remove this block from the "Préférences" card:

```tsx
            <Divider />
            <PressableRow icon="flag-outline" label="Signaler un problème" onPress={() => router.push("/report")} />
```

So the card becomes:

```tsx
      <Card className="gap-1">
        <PressableRow icon="notifications" label="Réactiver les notifications" onPress={reRegisterPush} />
        <Divider />
        <PressableRow icon="help-circle-outline" label="Comment ça marche" onPress={() => router.push("/onboarding")} />
      </Card>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS, no unused-import or type errors in either file.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/parcel/[id].tsx apps/mobile/app/settings.tsx
git commit -m "feat(mobile): move report entry point to parcel detail, off Settings"
```

---

## Self-Review Notes

- **Spec coverage:** POST/GET /disputes (Task 3) ✓, reasons aligned to `DisputeReason` (Task 4/5) ✓, role-filtered reasons (Task 5) ✓, entry point moved to parcel detail + removed from Settings (Task 6) ✓, out-of-scope items (admin queue, evidence upload, DISPUTED guards elsewhere) explicitly not implemented and called out in Task 3's file header ✓. The spec's `trip/[id].tsx` entry point is intentionally dropped — see "Correction vs. the approved spec" above.
- **Type consistency:** `Dispute.reason`/`status` types match across `packages/db` (Prisma enum) → `apps/mobile/src/lib/types.ts` (`DisputeReason`/`DisputeStatus`) → `apps/mobile/src/lib/disputes.ts` (`Dispute` interface) → `report/[parcelId].tsx` usage. `counterpartyOf`'s signature (Task 2) matches its Task 3 call site exactly.
- **Task ordering:** Tasks 1–2 (backend leaf helpers) → Task 3 (route, depends on both) → Task 4 (mobile API wrapper, independent of backend tasks but must exist before Task 5) → Task 5 (screen, depends on Task 4) → Task 6 (wiring, depends on Task 5's route existing). Each task typechecks/tests green before the next starts.
