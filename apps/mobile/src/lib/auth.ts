/**
 * Auth API — typed wrappers over the backend /auth/* endpoints.
 *
 * Mirrors packages/api/src/routes/auth.ts exactly. The mobile never imports
 * the API package directly (different runtime, monorepo boundary); instead
 * these functions talk over HTTP via the apiFetch wrapper. The shapes here
 * must stay in sync with the backend's responses.
 */
import { apiFetch } from "./api";

export interface SignupInput {
  email: string;
  phone: string; // E.164: +213...
  password: string;
  firstName: string;
  lastName: string;
  referralCode?: string;
}

export interface SignupResponse {
  user: { id: string; email: string; phone: string; firstName: string };
  message: string;
}

export function signup(input: SignupInput): Promise<SignupResponse> {
  return apiFetch("/auth/signup", { method: "POST", body: input, noAuth: true, noQueue: true });
}

export interface VerifyPhoneInput {
  phone: string;
  code: string; // 6 digits
}

export interface AuthSession {
  user: { id: string; kycLevel: string };
  accessToken: string;
  refreshToken: string;
}

export function verifyPhone(input: VerifyPhoneInput): Promise<AuthSession> {
  return apiFetch("/auth/verify-phone", {
    method: "POST",
    body: input,
    noAuth: true,
    noQueue: true,
  });
}

export interface LoginInput {
  email: string;
  password: string;
}

export function login(input: LoginInput): Promise<AuthSession> {
  return apiFetch("/auth/login", { method: "POST", body: input, noAuth: true, noQueue: true });
}

/** Profile — GET /me shape (subset the home screen needs). */
export interface Me {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  kycLevel: string;
  trustScore: number;
  trustBadge: string | null;
  completedTrips: number;
  completedDeliveries: number;
  averageRating: number;
}

export function fetchMe(): Promise<{ user: Me }> {
  return apiFetch("/me");
}
