/**
 * Database helper for integration tests — truncates all tables in FK-safe order.
 *
 * Use `ensureCleanDB()` instead of calling truncateAllTables directly.
 * Safe for sequential test execution (--test-concurrency=1).
 */
import { prisma } from "@crowdshipping/db";

async function truncateAllTables(): Promise<void> {
  const tables = [
    "ChatMessage",
    "Notification",
    "Rating",
    "Dispute",
    "CustomsClearanceLog",
    "TripCheckpoint",
    "EscrowLedger",
    "Parcel",
    "Trip",
    "KycSubmission",
    "User",
  ] as const;

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
    } catch {
      // Table may not exist in early schema versions — ignore
    }
  }
}

/** Truncates all tables. Safe for sequential test execution. */
export async function ensureCleanDB(): Promise<void> {
  await prisma.$connect();
  await truncateAllTables();
}
