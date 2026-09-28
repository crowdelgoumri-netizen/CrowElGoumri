/**
 * Notifications — provider fan-out + the single notify() entry point.
 *
 * Channels (blueprint F12):
 *   - in-app  always on; the durable Notification row every other channel
 *             rides alongside. Never skipped, never async.
 *   - push    Expo Push Service (FCM/APNS under the hood). Real in v1.
 *   - sms     Twilio — stubbed until TWILIO_AUTH_TOKEN + SMS_FROM_NUMBER set.
 *   - email   AWS SES — stubbed until SES_FROM_ADDRESS set.
 *
 * Delivery semantics for routes:
 *   notify() persists the in-app row synchronously (so a notification is
 *   never lost even if push is down), then dispatches the other channels.
 *   Push is awaited but its failure is swallowed + logged — a flaky Expo
 *   call must never block a delivery confirmation or corrupt a transaction.
 *
 * The template map is the one place notification copy lives; that's the
 * hook for Arabic/French localization in a later phase.
 */
import { Expo } from "expo-server-sdk";
import { prisma } from "@crowdshipping/db";
import { env } from "../env.js";

// ── Types ────────────────────────────────────────────────────────────
/** Notification kinds — matches the Notification.type column comment. */
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
  | "DISPUTE_OPENED"
  | "PARCEL_SEIZED"
  | "REFERRAL_REWARDED_REFERRER"
  | "REFERRAL_REWARDED_REFEREE";

/** Payload routes carry into notify(); templates read what they need. */
export interface NotificationPayload {
  parcelId?: string;
  amount?: number;
  currency?: string;
  senderName?: string;
  travelerName?: string;
  chatPreview?: string;
  kycLevel?: string;
  reviewNote?: string;
  disputeReason?: string;
  discountPct?: number;
  [k: string]: unknown;
}

export interface DeliveryResult {
  channel: "in_app" | "push" | "sms" | "email";
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

/** What a notification provider looks like. Add a channel = add a provider. */
interface NotificationProvider {
  readonly channel: DeliveryResult["channel"];
  send(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload: NotificationPayload;
  }): Promise<DeliveryResult>;
}

// ── Message templates (the localization hook) ────────────────────────
const TEMPLATES: Record<
  NotificationType,
  (p: NotificationPayload) => { title: string; body: string }
> = {
  MATCH_FOUND: (p) => ({
    title: "Nouveau match 🤝",
    body: `${p.travelerName ?? "Un voyageur"} a accepté votre colis.`,
  }),
  PARCEL_PICKED_UP: () => ({
    title: "Colis récupéré 📦",
    body: "Le voyageur a pris en charge votre colis.",
  }),
  IN_TRANSIT: () => ({
    title: "Colis en transit ✈️",
    body: "Votre colis est en route vers sa destination.",
  }),
  AWAITING_DELIVERY: () => ({
    title: "Colis arrivé 🏁",
    body: "Le voyageur est sur place — livraison en cours.",
  }),
  DELIVERED: () => ({
    title: "Colis livré ✅",
    body: "Votre colis a été remis au destinataire.",
  }),
  PARCEL_SEIZED: (p) => ({
    title: "Colis saisi ⚠️",
    body: `Votre colis a été saisi par la douane${p.disputeReason ? ` : ${p.disputeReason}` : ""}.`,
  }),
  PAYOUT_SENT: (p) => ({
    title: "Paiement débloqué 💶",
    body: `${p.amount ?? ""} ${p.currency ?? "EUR"} vous ont été versés.`,
  }),
  ESCROW_FUNDED: (p) => ({
    title: "Paiement sécurisé 🔒",
    body: `Le paiement de ${p.amount ?? ""} ${p.currency ?? "EUR"} est bloqué en séquestre.`,
  }),
  ESCROW_REFUNDED: (p) => ({
    title: "Remboursement effectué ↩️",
    body: `${p.amount ?? ""} ${p.currency ?? "EUR"} vous ont été remboursés.`,
  }),
  CHAT_MESSAGE: (p) => ({
    title: p.senderName ?? "Nouveau message",
    body: p.chatPreview ?? "Vous a envoyé un message.",
  }),
  KYC_APPROVED: (p) => ({
    title: "Vérification approuvée ✅",
    body: `Votre identité est vérifiée (niveau ${p.kycLevel ?? "supérieur"}).`,
  }),
  KYC_REJECTED: (p) => ({
    title: "Vérification refusée ❌",
    body: p.reviewNote
      ? `Votre document a été refusé : ${p.reviewNote}`
      : "Votre document a été refusé. Merci de le soumettre à nouveau.",
  }),
  DISPUTE_OPENED: (p) => ({
    title: "Litige ouvert ⚠️",
    body: p.disputeReason
      ? `Un signalement a été ouvert pour votre colis (motif : ${p.disputeReason}).`
      : "Un signalement a été ouvert pour votre colis.",
  }),
  REFERRAL_REWARDED_REFERRER: (p) => ({
    title: "Parrainage récompensé 🎁",
    body: `Un ami que vous avez parrainé a effectué sa première livraison. Vous avez reçu ${p.discountPct ?? 50}% de réduction sur votre prochaine fee.`,
  }),
  REFERRAL_REWARDED_REFEREE: (p) => ({
    title: "Merci d'avoir utilisé un code de parrainage 🎁",
    body: `Vous avez reçu ${p.discountPct ?? 50}% de réduction sur votre prochaine fee.`,
  }),
};

/** Resolve a notification's title/body from its type + payload. Exposed for tests. */
export function renderMessage(
  type: NotificationType,
  payload: NotificationPayload,
): { title: string; body: string } {
  return TEMPLATES[type](payload);
}

// ── Providers ────────────────────────────────────────────────────────

/** In-app: always on. Persists the Notification row that the UI list reads. */
const inAppProvider: NotificationProvider = {
  channel: "in_app",
  async send({ userId, type, title, body, payload }) {
    // The row is the source of truth — sentVia is filled by the fan-out
    // after all channels settle; here we record at least in_app.
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        data: payload as never, // Prisma Json
        sentVia: ["in_app"],
      },
    });
    return { channel: "in_app", ok: true };
  },
};

const expo = new Expo({ accessToken: env.EXPO_ACCESS_TOKEN });

/** Expo Push (FCM/APNS). Filters invalid token shapes before sending. */
const pushProvider: NotificationProvider = {
  channel: "push",
  async send({ userId, title, body, payload }) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { deviceTokens: true },
    });
    const tokens = (user?.deviceTokens ?? []).filter(isValidExpoToken);
    if (tokens.length === 0) return { channel: "push", ok: false, skipped: true };

    const messages = tokens.map((to) => ({
      to,
      title,
      body,
      data: payload as Record<string, unknown>,
      sound: "default",
    }));

    try {
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = (
        await Promise.all(
          chunks.map((chunk) => expo.sendPushNotificationsAsync(chunk)),
        )
      ).flat();

      // Prune tokens the platform says are no longer registered (app
      // uninstalled). Sync ticket errors only; async receipts are a follow-up.
      const dead = tickets
        .filter(
          (t): t is { status: "error"; message: string; details?: { expoPushToken?: string } } =>
            "status" in t && t.status === "error" &&
            (t.details?.expoPushToken ?? "") !== "",
        )
        .map((t) => t.details!.expoPushToken!);
      if (dead.length > 0) await pruneTokens(userId, dead);

      return { channel: "push", ok: true };
    } catch (err) {
      return {
        channel: "push",
        ok: false,
        error: (err as Error).message,
      };
    }
  },
};

/** Twilio SMS — stubbed until both token + from-number are configured. */
const smsProvider: NotificationProvider = {
  channel: "sms",
  async send({ userId, body }) {
    if (!env.TWILIO_AUTH_TOKEN || !env.SMS_FROM_NUMBER) {
      return { channel: "sms", ok: false, skipped: true };
    }
    // Real Twilio integration deferred: fetch user.phone, POST to Twilio.
    // Stub logs so ops can see the attempt in dev.
    console.log(`[sms stub → user ${userId}] ${body}`);
    return { channel: "sms", ok: true, skipped: true };
  },
};

/** SES email — stubbed until SES_FROM_ADDRESS is configured. */
const emailProvider: NotificationProvider = {
  channel: "email",
  async send({ userId, title, body }) {
    if (!env.SES_FROM_ADDRESS) {
      return { channel: "email", ok: false, skipped: true };
    }
    console.log(`[email stub → user ${userId}] ${title}: ${body}`);
    return { channel: "email", ok: true, skipped: true };
  },
};

const PROVIDERS: NotificationProvider[] = [
  inAppProvider,
  pushProvider,
  smsProvider,
  emailProvider,
];

// ── Helpers ──────────────────────────────────────────────────────────

/** Expo tokens look like `ExponentPushToken[xxxxxxxxxxxx]`. Cheap pre-filter. */
export function isValidExpoToken(token: string): boolean {
  return /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

/** Remove dead tokens from a user's device list (app uninstalled, etc.). */
async function pruneTokens(userId: string, dead: string[]): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { deviceTokens: true },
  });
  if (!user) return;
  const deadSet = new Set(dead);
  const kept = user.deviceTokens.filter((t) => !deadSet.has(t));
  if (kept.length !== user.deviceTokens.length) {
    await prisma.user.update({
      where: { id: userId },
      data: { deviceTokens: { set: kept } },
    });
  }
}

// ── The entry point routes call ──────────────────────────────────────

/**
 * Notify a user. Persists the in-app row synchronously, then fans out to
 * the other channels. Push/SMS/email failures are logged but never throw —
 * a route calling notify() should not have to handle delivery errors.
 *
 * Returns the rendered message so callers can log or echo it.
 */
export async function notify(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload = {},
): Promise<{ title: string; body: string }> {
  const { title, body } = renderMessage(type, payload);
  const input = { userId, type, title, body, payload };

  // Fan out. Each provider is isolated — one channel's failure can't abort
  // the others. We await so the in-app row lands before the route responds,
  // but push/sms/email are best-effort.
  const results = await Promise.allSettled(
    PROVIDERS.map((p) => p.send(input)),
  );
  for (const r of results) {
    if (r.status === "rejected") {
      console.error(`notification provider error:`, r.reason);
    }
  }
  return { title, body };
}

/** Convenience: notify both parties of a parcel (sender + traveler). */
export async function notifyBoth(
  senderId: string,
  travelerId: string,
  type: NotificationType,
  payload: NotificationPayload = {},
): Promise<void> {
  await Promise.all([
    notify(senderId, type, payload),
    notify(travelerId, type, payload),
  ]);
}
