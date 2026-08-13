import { apiFetch } from "./api";

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  role: string;
  kycLevel: string;
}

export interface LoginResponse {
  user: AdminUser;
  accessToken: string;
  refreshToken: string;
}

export function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    noAuth: true,
  });
}
