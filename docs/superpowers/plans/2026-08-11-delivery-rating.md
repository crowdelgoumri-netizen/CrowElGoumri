# Delivery Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `Rating` Prisma model to a real API and a star-rating prompt on the delivery confirmation screen, and make that screen reachable (it currently has no navigation entry point anywhere in the app).

**Architecture:** A new Fastify route file `packages/api/src/routes/ratings.ts` reuses `assertParcelParticipant`/`counterpartyOf` from `lib/chat-access.ts` (same helpers `disputes.ts` uses) for authorization and counterparty resolution, and calls the pre-existing `recomputeTrustForUser` after every successful rating — closing a gap its own doc comment has flagged since it was written. On mobile, `apps/mobile/app/delivery/[parcelId].tsx` (built but currently orphaned — nothing links to it) gains a rating prompt for its `DELIVERED` branch, and `apps/mobile/app/parcel/[id].tsx` gains the missing navigation entry point.

**Tech Stack:** Fastify 5 + Zod (backend), Prisma (`@crowdshipping/db`), Expo Router + NativeWind + Zustand (mobile), `@expo/vector-icons` for the star widget.

## Global Constraints

- All money/currency is EUR-only in v1 (unaffected by this plan).
- Backend routes use Fastify + Zod validation, `app.authenticate` preHandler, and the `prisma` singleton from `@crowdshipping/db` — follow `disputes.ts`/`chat.ts` conventions exactly.
- `toUserId` on a rating is always resolved server-side via `counterpartyOf` — never trust a client-supplied target user id.
- Bidirectional rating: both the sender and the matched traveler can each rate the other once per parcel (confirmed product decision — differs from the original design mockup's sender-only flow).
- A rating can only be created once `parcel.status === "DELIVERED"`.
- Mobile screens use the existing `Screen`/`ScreenHeader`/`Card`/`Button`/`Input` components and `useAsync` hook — do not create new shared primitives; the star widget is a small function local to `delivery/[parcelId].tsx`, not a new shared component.
- Mobile has no test suite; verification is `pnpm --filter @crowdshipping/mobile typecheck`. Backend verification is `pnpm --filter @crowdshipping/api test` (runs `node --import tsx --test src/test/*.test.ts`) and `pnpm --filter @crowdshipping/api typecheck`.
- French UI copy throughout.
- No admin/moderation surface, no rating edits after submission, no public display of individual reviews beyond the existing `averageRating` already exposed by `GET /me` — all explicitly out of scope per the approved spec (`docs/superpowers/specs/2026-08-11-delivery-rating-design.md`).

---

## Correction vs. the approved spec

The spec didn't anticipate that `apps/mobile/app/delivery/[parcelId].tsx` has no navigation entry point anywhere in the app (`grep -rn "delivery/" apps/mobile/app apps/mobile/src` outside that file itself returns nothing) — the traveler currently has no way to confirm a delivery at all. Task 4 below adds that entry point; without it, the rating widget built in Task 3 would be as unreachable as the screen it lives on. The human partner confirmed including this fix in this plan.

---

### Task 1: `ratings.ts` route (POST /ratings, GET /ratings/:parcelId)

**Files:**
- Create: `packages/api/src/routes/ratings.ts`
- Modify: `packages/api/src/server.ts`

**Interfaces:**
- Consumes: `assertParcelParticipant`, `counterpartyOf`, `HttpError` from `../lib/chat-access.js`; `recomputeTrustForUser` from `../lib/trust-service.js`; `prisma`, `Prisma` from `@crowdshipping/db`.
- Produces: `ratingRoutes: FastifyPluginAsync`, registered at prefix `/ratings`. `POST /ratings` body `{ parcelId, score, comment? }` → `201 { rating }` or `400`/`403`/`404`/`409`. `GET /ratings/:parcelId` → `{ ratings: Rating[] }` (0-2 rows) or `403`/`404`.

- [ ] **Step 1: Write the route file**

Create `packages/api/src/routes/ratings.ts`:

```ts
/**
 * Ratings — bidirectional post-delivery feedback (sender ↔ traveler).
 *
 * One rating per (fromUserId, toUserId, parcelId) — enforced by the Prisma
 * schema's unique constraint. toUserId is never taken from the client: it's
 * resolved server-side via counterpartyOf, so a caller can't rate themselves
 * or target the wrong participant. Every successful rating recomputes the
 * rated user's averageRating and refreshes their cached trust score —
 * lib/trust-service.ts's own doc comment has asked for this call ("after a
 * new rating") since it was written; nothing wired it until now.
 *
 * Endpoints:
 *   POST /ratings            rate the counterparty on a delivered parcel
 *   GET  /ratings/:parcelId  read both ratings for a parcel (participants only)
 */
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { prisma, Prisma } from "@crowdshipping/db";
import { assertParcelParticipant, counterpartyOf, HttpError } from "../lib/chat-access.js";
import { recomputeTrustForUser } from "../lib/trust-service.js";

const rateSchema = z.object({
  parcelId: z.string().min(1),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

function sendHttpError(reply: FastifyReply, err: unknown) {
  if (err instanceof HttpError) {
    return reply.code(err.status).send({ error: err.message });
  }
  reply.code(500).send({ error: "Internal error" });
}

/** Recompute a user's averageRating from all ratings they've received, then refresh trust. */
async function recomputeAverageRating(userId: string): Promise<void> {
  const { _avg } = await prisma.rating.aggregate({
    where: { toUserId: userId },
    _avg: { score: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { averageRating: _avg.score ?? 0 },
  });
  await recomputeTrustForUser(userId);
}

export const ratingRoutes: FastifyPluginAsync = async (app) => {
  // ── POST /ratings — rate the counterparty on a delivered parcel ────
  app.post(
    "/",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = rateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.flatten() });
      }
      const { parcelId, score, comment } = parsed.data;
      const userId = req.user.sub;

      let participant;
      try {
        participant = await assertParcelParticipant(parcelId, userId);
      } catch (err) {
        return sendHttpError(reply, err);
      }

      const toUserId = counterpartyOf(participant);
      if (!toUserId) {
        return reply.code(409).send({ error: "No counterparty to rate on this parcel" });
      }

      const parcel = await prisma.parcel.findUnique({
        where: { id: parcelId },
        select: { status: true },
      });
      if (!parcel) {
        return reply.code(404).send({ error: "Parcel not found" });
      }
      if (parcel.status !== "DELIVERED") {
        return reply.code(409).send({ error: "Parcel not yet delivered" });
      }

      let rating;
      try {
        rating = await prisma.rating.create({
          data: { parcelId, fromUserId: userId, toUserId, score, comment },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return reply.code(409).send({ error: "You already rated this parcel" });
        }
        throw err;
      }

      await recomputeAverageRating(toUserId);

      return reply.code(201).send({ rating });
    },
  );

  // ── GET /ratings/:parcelId — both ratings for a parcel ──────────────
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

      const ratings = await prisma.rating.findMany({ where: { parcelId } });
      return { ratings };
    },
  );
};
```

- [ ] **Step 2: Register the route in server.ts**

In `packages/api/src/server.ts`, add the import after `import { disputeRoutes } from "./routes/disputes.js";`:

```ts
import { disputeRoutes } from "./routes/disputes.js";
import { ratingRoutes } from "./routes/ratings.js";
```

And register it after `await app.register(disputeRoutes, { prefix: "/disputes" });`:

```ts
  await app.register(disputeRoutes, { prefix: "/disputes" });
  await app.register(ratingRoutes, { prefix: "/ratings" });
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @crowdshipping/api typecheck`
Expected: PASS, no type errors.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm --filter @crowdshipping/api test`
Expected: PASS (58/58 or however many currently exist — this task adds no new test file. `recomputeAverageRating` is a thin DB read/persist wrapper exactly like `recomputeTrustForUser`, which the codebase's own `trust-service.test.ts` deliberately doesn't unit-test — see that file's header comment for why. The route's authorization and counterparty resolution are already covered by `chat-access.test.ts`'s existing `assertParcelParticipant`/`counterpartyOf` tests).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/ratings.ts packages/api/src/server.ts
git commit -m "feat(api): add POST/GET /ratings routes"
```

---

### Task 2: Mobile `lib/ratings.ts` API wrapper

**Files:**
- Create: `apps/mobile/src/lib/ratings.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./api` (existing).
- Produces: `type Rating`, `submitRating(input: SubmitRatingInput): Promise<{ rating: Rating }>`, `getRatings(parcelId: string): Promise<{ ratings: Rating[] }>` — consumed by Task 3.

- [ ] **Step 1: Write the API wrapper**

Create `apps/mobile/src/lib/ratings.ts`:

```ts
/**
 * Ratings API — typed wrappers over /ratings.
 *
 * Mirrors packages/api/src/routes/ratings.ts. Bidirectional: after a parcel
 * is DELIVERED, both the sender and the matched traveler can each submit
 * one rating of the other. Once GET returns a row where fromUserId matches
 * the caller, the delivery screen shows a "thanks" state instead of the
 * star form.
 */
import { apiFetch } from "./api";

export interface Rating {
  id: string;
  parcelId: string;
  fromUserId: string;
  toUserId: string;
  score: number;
  comment: string | null;
  createdAt: string;
}

export interface SubmitRatingInput {
  parcelId: string;
  score: number;
  comment?: string;
}

export function submitRating(input: SubmitRatingInput): Promise<{ rating: Rating }> {
  return apiFetch("/ratings", { method: "POST", body: input });
}

export function getRatings(parcelId: string): Promise<{ ratings: Rating[] }> {
  return apiFetch(`/ratings/${parcelId}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/lib/ratings.ts
git commit -m "feat(mobile): add ratings API wrapper"
```

---

### Task 3: Rating prompt on `delivery/[parcelId].tsx`

**Files:**
- Modify: `apps/mobile/app/delivery/[parcelId].tsx`

**Interfaces:**
- Consumes: `submitRating`, `getRatings`, `type Rating` from `../../src/lib/ratings` (Task 2); existing `useAsync`, `useAuth`, `ApiError`, `Card`, `Button`, `Input` already imported in this file; `Ionicons` from `@expo/vector-icons` (new import).

- [ ] **Step 1: Add the ratings fetch and Ionicons/Pressable imports**

In `apps/mobile/app/delivery/[parcelId].tsx`, change the import block from:

```tsx
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, Text, View } from "react-native";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import {
  deliverParcel,
  generateDeliveryPin,
  getParcel,
} from "../../src/lib/parcels";
import { ApiError } from "../../src/lib/api";
```

to:

```tsx
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../src/components/Screen";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { Card } from "../../src/components/Card";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { useAuth } from "../../src/store/auth";
import { useAsync } from "../../src/hooks/useAsync";
import {
  deliverParcel,
  generateDeliveryPin,
  getParcel,
} from "../../src/lib/parcels";
import { getRatings, submitRating, type Rating } from "../../src/lib/ratings";
import { ApiError } from "../../src/lib/api";
```

- [ ] **Step 2: Fetch ratings and compute `myRating`**

In `DeliveryScreen`, right after the existing `const { data, loading, error, refresh } = useAsync(() => getParcel(parcelId), [parcelId]);` line, add:

```tsx
  const {
    data: ratingsData,
    setData: setRatingsData,
  } = useAsync(() => getRatings(parcelId), [parcelId]);
```

Then, right after the existing `const isSender = ...` / `const isTraveler = ...` lines, add:

```tsx
  const myRating = ratingsData?.ratings.find((r) => r.fromUserId === user?.id) ?? null;
```

- [ ] **Step 3: Replace the DELIVERED branch with the rating flow**

Replace this block:

```tsx
        {parcel.status === "DELIVERED" ? (
          <Card className="bg-success/10 border-success/30">
            <Text className="text-success font-heading font-bold text-lg">Colis livré ✓</Text>
            <Text className="text-mist font-body text-sm mt-1">
              La livraison a déjà été confirmée.
            </Text>
          </Card>
        ) : isSender ? (
```

with:

```tsx
        {parcel.status === "DELIVERED" ? (
          <View className="gap-md">
            <Card className="bg-success/10 border-success/30">
              <Text className="text-success font-heading font-bold text-lg">Colis livré ✓</Text>
              <Text className="text-mist font-body text-sm mt-1">
                La livraison a déjà été confirmée.
              </Text>
            </Card>
            {myRating ? (
              <RatingSubmitted rating={myRating} />
            ) : (
              <RatingPrompt
                parcelId={parcel.id}
                onSubmitted={(rating) =>
                  setRatingsData((prev) => ({
                    ratings: [...(prev?.ratings ?? []), rating],
                  }))
                }
              />
            )}
          </View>
        ) : isSender ? (
```

(Only the `parcel.status === "DELIVERED"` branch's content changes — the `isSender`/`isTraveler`/final-else branches below it are untouched.)

- [ ] **Step 4: Add the `RatingPrompt` and `RatingSubmitted` components**

At the end of the file, after the existing `export default function DeliveryScreen() { ... }` closing brace, add:

```tsx
function RatingPrompt({
  parcelId,
  onSubmitted,
}: {
  parcelId: string;
  onSubmitted: (rating: Rating) => void;
}) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (score < 1) {
      Alert.alert("Note manquante", "Choisissez une note de 1 à 5 étoiles.");
      return;
    }
    setSubmitting(true);
    try {
      const { rating } = await submitRating({
        parcelId,
        score,
        comment: comment.trim() || undefined,
      });
      onSubmitted(rating);
    } catch (e) {
      Alert.alert("Impossible", e instanceof ApiError ? e.message : "Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-md">
      <Text className="text-white font-heading font-bold">Notez votre expérience</Text>
      <View className="flex-row gap-2 justify-center">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setScore(n)} hitSlop={8}>
            <Ionicons
              name={n <= score ? "star" : "star-outline"}
              size={32}
              color="#FF6A2B"
            />
          </Pressable>
        ))}
      </View>
      <Input
        label="Commentaire (optionnel)"
        value={comment}
        onChangeText={setComment}
        placeholder="Un mot sur votre expérience…"
        multiline
        className="h-20"
      />
      <Button label="Envoyer mon avis" onPress={submit} loading={submitting} />
    </Card>
  );
}

function RatingSubmitted({ rating }: { rating: Rating }) {
  return (
    <Card className="gap-2 bg-violet/10 border-violet/30">
      <Text className="text-white font-body font-semibold">Merci pour votre avis !</Text>
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Ionicons
            key={n}
            name={n <= rating.score ? "star" : "star-outline"}
            size={18}
            color="#FF6A2B"
          />
        ))}
      </View>
      {rating.comment ? (
        <Text className="text-muted font-body text-sm mt-1">{rating.comment}</Text>
      ) : null}
    </Card>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/delivery/[parcelId].tsx
git commit -m "feat(mobile): add star-rating prompt to delivery confirmation"
```

---

### Task 4: Entry point into `delivery/[parcelId].tsx` from `parcel/[id].tsx`

**Files:**
- Modify: `apps/mobile/app/parcel/[id].tsx`

**Interfaces:**
- Consumes: nothing new — pure JSX/routing addition using the existing `router` import.

- [ ] **Step 1: Add the gate and the button**

In `apps/mobile/app/parcel/[id].tsx`, right after the existing `const canReport = ...` line, add:

```tsx
  const canGoToDelivery = parcel.status === "AWAITING_DELIVERY" || parcel.status === "DELIVERED";
```

Then, in the "Actions" `View` block, add the new button right after the `matched ? <Button label="Générer le code de livraison" ...> : null` block (i.e. between that button and the `inMotion ? <Button label="Suivre le colis" ...> : null` block):

```tsx
          {matched ? (
            <Button
              label="Générer le code de livraison"
              variant="secondary"
              onPress={onGeneratePin}
              loading={busy}
            />
          ) : null}
          {canGoToDelivery ? (
            <Button
              label={parcel.status === "DELIVERED" ? "Livraison & avis" : "Confirmer la livraison"}
              variant="secondary"
              onPress={() => router.push(`/delivery/${parcel.id}`)}
            />
          ) : null}
          {inMotion ? (
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @crowdshipping/mobile typecheck`
Expected: PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/parcel/[id].tsx
git commit -m "feat(mobile): add navigation entry point to the delivery screen"
```

---

## Self-Review Notes

- **Spec coverage:** POST/GET /ratings with server-resolved `toUserId` (Task 1) ✓, bidirectional rating (Task 1's `counterpartyOf` usage + Task 3's role-agnostic prompt) ✓, DELIVERED-only gate (Task 1) ✓, P2002 handled from the start, no fix-loop needed this time (Task 1) ✓, `averageRating` + trust recompute wired (Task 1) ✓, star widget + "thanks" state on the delivery screen (Task 3) ✓, out-of-scope items (rating edits, public review display, admin surface) not implemented ✓. The spec didn't cover the missing navigation entry point — Task 4 is the human-approved addition, documented above in "Correction vs. the approved spec".
- **Type consistency:** `Rating`'s fields in `apps/mobile/src/lib/ratings.ts` (Task 2) match the Prisma `Rating` model (`packages/db/schema.prisma`) and the route's `prisma.rating.create`/`findMany` return shape (Task 1) exactly — `score: number`, `comment: string | null`. `RatingPrompt`'s `onSubmitted: (rating: Rating) => void` (Task 3) matches `submitRating`'s resolved `{ rating: Rating }` (Task 2).
- **Task ordering:** Task 1 (backend, independent) → Task 2 (mobile API wrapper, independent of Task 1 but must exist before Task 3) → Task 3 (delivery screen, depends on Task 2) → Task 4 (entry point, depends on Task 3's screen actually having something worth reaching — ordered last so the screen is complete before it's wired up, though Tasks 3 and 4 touch different files and don't have a hard technical dependency on each other's diff). Each task typechecks/tests green before the next starts.
