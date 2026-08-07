/**
 * Password hashing — bcrypt with cost 12.
 * Cost 12 is the OWASP-recommended floor as of 2024; balances security
 * against login latency (~250ms on modern hardware).
 */
import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
