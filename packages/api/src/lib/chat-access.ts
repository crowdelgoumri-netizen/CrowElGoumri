/**
 * Chat access control — the single source of truth for "who can touch this
 * thread".
 *
 * A chat thread is scoped to a parcel. The only participants are the
 * parcel's sender and the traveler on the parcel's matched trip. No match
 * → no thread (the would-be traveler can't message a sender who hasn't
 * accepted them). This helper is shared by both the Socket.IO join guard
 * and the REST routes so the rule can't drift between transports.
 */
import { prisma } from "@crowdshipping/db";

export type ChatRole = "SENDER" | "TRAVELER";

export interface ParcelParticipant {
  parcelId: string;
  senderId: string;
  travelerId: string | null;
  role: ChatRole;
}

/**
 * HTTP-shaped error: carries a status code so route handlers can forward
 * it directly (reply.code(e.status).send({ error: e.message })) and socket
 * handlers can map it to a disconnect reason.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Resolve the caller's role on a parcel thread, or throw HttpError:
 *   404 — parcel doesn't exist, or has no matched trip yet (no thread).
 *   403 — caller is neither the sender nor the matched traveler.
 *
 * We deliberately treat "no match" as 404 rather than 403: a sender who
 * hasn't been matched has no thread to expose, and an unmatched traveler
 * probing a parcelId shouldn't learn that the parcel exists at all.
 */
export async function assertParcelParticipant(
  parcelId: string,
  userId: string,
): Promise<ParcelParticipant> {
  const parcel = await prisma.parcel.findUnique({
    where: { id: parcelId },
    select: { senderId: true, matchedTrip: { select: { travelerId: true } } },
  });

  if (!parcel || !parcel.matchedTrip) {
    throw new HttpError(404, "No chat thread for this parcel");
  }

  const travelerId = parcel.matchedTrip.travelerId;
  let role: ChatRole | null = null;
  if (userId === parcel.senderId) role = "SENDER";
  else if (userId === travelerId) role = "TRAVELER";

  if (!role) {
    throw new HttpError(403, "Not a participant in this chat thread");
  }

  return { parcelId, senderId: parcel.senderId, travelerId, role };
}
