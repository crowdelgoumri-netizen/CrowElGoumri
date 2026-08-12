# apps/admin: KYC Review Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/admin`, a new Next.js internal dashboard with exactly two screens — admin login and the KYC manual-review queue — wired to the backend's existing `/auth/login` and `/kyc/admin/*` routes.

**Architecture:** A standalone Next.js 14 App Router app in the pnpm workspace (`@crowdshipping/admin`). Client-side only — no SSR data fetching, no server actions. A JWT from `/auth/login` is kept in `localStorage`; a client-side `AuthGate` wrapping the root layout redirects between `/login` and `/` based on token presence. All backend calls go through a small `apiFetch` wrapper mirroring `apps/mobile/src/lib/api.ts`'s shape, minus the refresh-token logic (out of scope per the design spec).

**Tech Stack:** Next.js 14 (App Router), React 18.3.1, TypeScript (strict, extends the workspace's `tsconfig.base.json`), Tailwind CSS 3.4.

## Global Constraints

- Scope is **exactly** login + the KYC review queue. No nav, stubs, or placeholder screens for disputes/users/escrow — those have no backend routes yet.
- No refresh-token flow. A `401` from any API call clears the stored token; the next render's `AuthGate` check redirects to `/login`.
- Session storage is `localStorage` only (no cookies, no server session).
- Visual design: plain Tailwind utility classes, no custom design system, no dark mode requirement.
- `apiFetch` must only set `Content-Type: application/json` when a request body is actually sent — a bodyless POST with that header set crashes against this backend's Fastify JSON body parser (`FST_ERR_CTP_EMPTY_JSON_BODY`), a bug already hit and fixed once in the mobile app's client this session. Don't reintroduce it here.
- React/TypeScript/Tailwind versions must match `apps/mobile/package.json`'s pins exactly (`react`/`react-dom` `18.3.1`, `typescript` `^5.6.3`, `tailwindcss` `^3.4.17`) — this repo doesn't mix major versions of shared tooling across apps.

---

### Task 1: Scaffold the Next.js app shell

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/next.config.mjs`
- Create: `apps/admin/postcss.config.js`
- Create: `apps/admin/tailwind.config.ts`
- Create: `apps/admin/next-env.d.ts`
- Create: `apps/admin/.gitignore`
- Create: `apps/admin/app/globals.css`
- Create: `apps/admin/app/layout.tsx`
- Create: `apps/admin/app/page.tsx`
- Modify: `.claude/launch.json`

**Interfaces:**
- Produces: a working Next.js dev server at `http://localhost:3000` serving a placeholder `/` page. Later tasks replace `app/page.tsx`'s content and `app/layout.tsx`'s body.

- [ ] **Step 1: Create `apps/admin/package.json`**

```json
{
  "name": "@crowdshipping/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.2.15",
    "react": "18.3.1",
    "react-dom": "18.3.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "~18.3.12",
    "@types/react-dom": "~18.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.6.3"
  }
}
```

- [ ] **Step 2: Create `apps/admin/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "preserve",
    "noEmit": true,
    "isolatedModules": true,
    "incremental": true,
    "allowJs": true,
    "types": ["react", "react-dom", "node"],
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/admin/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/admin/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `apps/admin/tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create `apps/admin/next-env.d.ts`**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
```

- [ ] **Step 7: Create `apps/admin/.gitignore`**

```
node_modules
.next
.env*.local
```

- [ ] **Step 8: Create `apps/admin/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #f8fafc;
  color: #0f172a;
}
```

- [ ] **Step 9: Create `apps/admin/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CrowdShipping Admin",
  description: "Internal admin dashboard for CrowdShipping",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 10: Create `apps/admin/app/page.tsx`**

```tsx
export default function Home() {
  return <main className="p-8">Admin dashboard placeholder.</main>;
}
```

- [ ] **Step 11: Install dependencies from the workspace root**

Run: `pnpm install`
Expected: pnpm registers `@crowdshipping/admin` as a new workspace member (already covered by `apps/*` in `pnpm-workspace.yaml`) and installs its dependencies into the shared `node_modules`, updating the root `pnpm-lock.yaml`.

- [ ] **Step 12: Run typecheck**

Run: `pnpm --filter @crowdshipping/admin typecheck`
Expected: passes with no errors (`tsc --noEmit` exits 0, no output).

- [ ] **Step 13: Add a launch config entry so the dev server can be previewed**

Read `.claude/launch.json` first — it already has `crowdshipping-mobile-web` and `crowdshipping-api` entries from earlier work this session. Add a third entry to the `configurations` array:

```json
{
  "name": "crowdshipping-admin",
  "runtimeExecutable": "pnpm",
  "runtimeArgs": ["--filter", "@crowdshipping/admin", "dev"],
  "port": 3000,
  "autoPort": true
}
```

- [ ] **Step 14: Start the dev server and verify in the browser**

Start `crowdshipping-admin` via the preview tool (or run `pnpm --filter @crowdshipping/admin dev` directly and open `http://localhost:3000`).
Expected: the page renders the text "Admin dashboard placeholder." with no console errors.

- [ ] **Step 15: Commit**

```bash
git add apps/admin .claude/launch.json pnpm-lock.yaml
git commit -m "Scaffold apps/admin Next.js app shell"
```

---

### Task 2: API client + token storage

**Files:**
- Create: `apps/admin/src/lib/storage.ts`
- Create: `apps/admin/src/lib/api.ts`

**Interfaces:**
- Consumes: nothing (no dependency on Task 1's UI files).
- Produces: `getToken(): string | null`, `setToken(token: string): void`, `clearToken(): void` from `storage.ts`. `apiFetch<T>(path: string, opts?: ApiFetchOptions): Promise<T>`, `class ApiError extends Error { status: number; body?: unknown }`, `BASE_URL: string` from `api.ts`. Task 3's `auth.ts` and Task 4's `kyc.ts` both import `apiFetch` and `ApiError` from `./api`.

- [ ] **Step 1: Create `apps/admin/src/lib/storage.ts`**

```ts
const TOKEN_KEY = "cs_admin_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
```

- [ ] **Step 2: Create `apps/admin/src/lib/api.ts`**

```ts
/**
 * API client — fetch wrapper with JWT attach for the admin dashboard.
 *
 * No refresh-token flow (see design spec): a 401 clears the stored
 * session and the next AuthGate check redirects to /login.
 */
import { clearToken, getToken } from "./storage";

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Skip attaching the Authorization header (used by /auth/login itself). */
  noAuth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, noAuth } = opts;
  // Only set Content-Type when there's a body: this backend's Fastify JSON
  // parser rejects an empty body sent with 'application/json'.
  const headers: Record<string, string> =
    body !== undefined ? { "Content-Type": "application/json" } : {};

  if (!noAuth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
  }

  if (!res.ok) {
    let errBody: unknown;
    try {
      errBody = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const message =
      (errBody && typeof errBody === "object" && "error" in errBody
        ? String((errBody as { error: unknown }).error)
        : res.statusText) || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, errBody);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @crowdshipping/admin typecheck`
Expected: passes. Nothing imports these files yet, so there's no browser-visible change — Task 3 wires `apiFetch` into the login screen, where you'll see it work end-to-end.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/lib/storage.ts apps/admin/src/lib/api.ts
git commit -m "Add admin API client and token storage"
```

---

### Task 3: Login screen + route guard

**Files:**
- Create: `apps/admin/src/lib/auth.ts`
- Create: `apps/admin/src/components/AuthGate.tsx`
- Create: `apps/admin/app/login/page.tsx`
- Modify: `apps/admin/app/layout.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `ApiError` from `../lib/api` (Task 2); `getToken`, `setToken`, `clearToken` from `../lib/storage` (Task 2).
- Produces: `login(email: string, password: string): Promise<LoginResponse>` and `interface AdminUser { id: string; email: string; firstName: string; role: string; kycLevel: string }` from `auth.ts`. `AuthGate` component (default export style: named export `AuthGate`) that Task 5 does not need to touch again.

- [ ] **Step 1: Create `apps/admin/src/lib/auth.ts`**

```ts
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
```

- [ ] **Step 2: Create `apps/admin/src/components/AuthGate.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "../lib/storage";

/**
 * Route guard: no token outside /login -> redirect to /login.
 * A token present while on /login -> redirect to /.
 * Renders nothing until the check resolves, so protected content never
 * flashes before a redirect fires.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const token = getToken();
    if (!token && pathname !== "/login") {
      router.replace("/login");
      return;
    }
    if (token && pathname === "/login") {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) return null;
  return <>{children}</>;
}
```

- [ ] **Step 3: Create `apps/admin/app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../src/lib/api";
import { login } from "../../src/lib/auth";
import { setToken } from "../../src/lib/storage";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session = await login(email.trim(), password);
      if (session.user.role !== "ADMIN") {
        setError("This account doesn't have admin access.");
        return;
      }
      setToken(session.accessToken);
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-6 text-xl font-semibold text-slate-900">
          CrowdShipping Admin
        </h1>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        {error ? (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Modify `apps/admin/app/layout.tsx` to wrap children in `AuthGate`**

Replace the file's contents entirely with:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "../src/components/AuthGate";

export const metadata: Metadata = {
  title: "CrowdShipping Admin",
  description: "Internal admin dashboard for CrowdShipping",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @crowdshipping/admin typecheck`
Expected: passes.

- [ ] **Step 6: Promote a test account to ADMIN**

This session already has two test accounts in the dev DB from earlier mobile testing: `karim.test.smoke@example.com` (password `TestPass123`) and `nadia.test.smoke@example.com` (password `TestPass123`). Promote Karim's account to admin:

```bash
cd packages/db
cat > /tmp/promote-admin.sql <<'EOF'
UPDATE "User" SET role = 'ADMIN' WHERE email = 'karim.test.smoke@example.com';
EOF
npx prisma db execute --file=/tmp/promote-admin.sql
```

Expected output: a confirmation that the script executed successfully against the Neon dev database (no rows are printed by `db execute`; verify with a quick select if you want certainty: `echo "SELECT email, role FROM \"User\" WHERE email = 'karim.test.smoke@example.com';" > /tmp/check.sql && npx prisma db execute --file=/tmp/check.sql` won't print results either — `db execute` doesn't return query output. If you want to confirm, use `npx prisma studio` and check the row, or just proceed — the login test in the next step will surface it either way).

- [ ] **Step 7: Manually verify the full auth flow in the browser**

With the dev server running (`crowdshipping-admin` from Task 1, and `crowdshipping-api` on port 4000 also running):

1. Visit `http://localhost:3000/`. Expected: immediately redirected to `/login` (no token yet).
2. Log in with `nadia.test.smoke@example.com` / `TestPass123` (a non-admin account). Expected: form shows "This account doesn't have admin access." and stays on `/login`.
3. Log in with `karim.test.smoke@example.com` / `TestPass123` (the promoted admin). Expected: redirected to `/`, shows "Admin dashboard placeholder."
4. Reload `/`. Expected: stays on `/` (token persisted in `localStorage`).
5. Open browser dev tools, run `localStorage.removeItem("cs_admin_token")`, reload `/`. Expected: redirected to `/login`.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/lib/auth.ts apps/admin/src/components/AuthGate.tsx apps/admin/app/login/page.tsx apps/admin/app/layout.tsx
git commit -m "Add admin login screen and route guard"
```

---

### Task 4: KYC API client

**Files:**
- Create: `apps/admin/src/lib/kyc.ts`

**Interfaces:**
- Consumes: `apiFetch` from `./api` (Task 2).
- Produces: `interface KycSubmission`, `interface PendingResponse`, `listPending(limit: number, offset: number): Promise<PendingResponse>`, `reviewSubmission(id: string, decision: "APPROVED" | "REJECTED", note?: string): Promise<{ submission: KycSubmission }>`. Task 5's `SubmissionCard` and queue page both import from `../lib/kyc`.

- [ ] **Step 1: Create `apps/admin/src/lib/kyc.ts`**

```ts
import { apiFetch } from "./api";

export interface KycSubmissionUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface KycSubmission {
  id: string;
  userId: string;
  documentType:
    | "PASSPORT"
    | "NATIONAL_ID"
    | "DRIVERS_LICENSE"
    | "RESIDENCY_PERMIT";
  documentUrl: string;
  documentBackUrl: string | null;
  selfieUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewerId: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  targetLevel: "ENHANCED" | "FULL";
  createdAt: string;
  user: KycSubmissionUser;
}

export interface PendingResponse {
  submissions: KycSubmission[];
  total: number;
  limit: number;
  offset: number;
}

export function listPending(
  limit: number,
  offset: number,
): Promise<PendingResponse> {
  return apiFetch<PendingResponse>(
    `/kyc/admin/pending?limit=${limit}&offset=${offset}`,
  );
}

export function reviewSubmission(
  id: string,
  decision: "APPROVED" | "REJECTED",
  note?: string,
): Promise<{ submission: KycSubmission }> {
  return apiFetch<{ submission: KycSubmission }>(`/kyc/admin/${id}/review`, {
    method: "POST",
    body: note ? { decision, note } : { decision },
  });
}
```

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @crowdshipping/admin typecheck`
Expected: passes. No UI consumes this yet — Task 5 wires it into the queue screen.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/lib/kyc.ts
git commit -m "Add admin KYC review-queue API client"
```

---

### Task 5: KYC review queue screen

**Files:**
- Create: `apps/admin/src/components/SubmissionCard.tsx`
- Modify: `apps/admin/app/page.tsx`

**Interfaces:**
- Consumes: `ApiError` from `../lib/api` (Task 2); `listPending`, `reviewSubmission`, `KycSubmission` from `../lib/kyc` (Task 4); `clearToken` from `../lib/storage` (Task 2).
- Produces: the final user-facing screen. Nothing downstream depends on this task.

- [ ] **Step 1: Create `apps/admin/src/components/SubmissionCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ApiError } from "../lib/api";
import { reviewSubmission, type KycSubmission } from "../lib/kyc";

const TARGET_LEVEL_LABEL: Record<string, string> = {
  ENHANCED: "Enhanced",
  FULL: "Full",
};

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  PASSPORT: "Passport",
  NATIONAL_ID: "National ID",
  DRIVERS_LICENSE: "Driver's license",
  RESIDENCY_PERMIT: "Residency permit",
};

export function SubmissionCard({
  submission,
  onDecided,
}: {
  submission: KycSubmission;
  onDecided: (id: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setBusy(true);
    setError(null);
    try {
      await reviewSubmission(submission.id, decision, note.trim() || undefined);
      onDecided(submission.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to submit decision.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p className="font-medium text-slate-900">
            {submission.user.firstName} {submission.user.lastName}
          </p>
          <p className="text-sm text-slate-500">{submission.user.email}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
          Target: {TARGET_LEVEL_LABEL[submission.targetLevel] ?? submission.targetLevel}
        </span>
      </div>

      <p className="mb-3 text-sm text-slate-600">
        {DOCUMENT_TYPE_LABEL[submission.documentType] ?? submission.documentType} · submitted{" "}
        {new Date(submission.createdAt).toLocaleString()}
      </p>

      <div className="mb-4 flex gap-3">
        <a href={submission.documentUrl} target="_blank" rel="noreferrer">
          <img
            src={submission.documentUrl}
            alt="Document photo unavailable"
            className="h-24 w-24 rounded-md border border-slate-200 object-cover"
          />
        </a>
        {submission.documentBackUrl ? (
          <a href={submission.documentBackUrl} target="_blank" rel="noreferrer">
            <img
              src={submission.documentBackUrl}
              alt="Document back photo unavailable"
              className="h-24 w-24 rounded-md border border-slate-200 object-cover"
            />
          </a>
        ) : null}
        <a href={submission.selfieUrl} target="_blank" rel="noreferrer">
          <img
            src={submission.selfieUrl}
            alt="Selfie photo unavailable"
            className="h-24 w-24 rounded-md border border-slate-200 object-cover"
          />
        </a>
      </div>

      {error ? (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {rejecting ? (
        <div className="mb-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reason for rejection (recommended)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            rows={2}
          />
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          onClick={() => decide("APPROVED")}
          disabled={busy}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "…" : "Approve"}
        </button>
        {rejecting ? (
          <button
            onClick={() => decide("REJECTED")}
            disabled={busy}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "…" : "Confirm reject"}
          </button>
        ) : (
          <button
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            Reject
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `apps/admin/app/page.tsx` entirely**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubmissionCard } from "../src/components/SubmissionCard";
import { ApiError } from "../src/lib/api";
import { listPending, type KycSubmission } from "../src/lib/kyc";
import { clearToken } from "../src/lib/storage";

const PAGE_SIZE = 20;

export default function QueuePage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(nextOffset: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await listPending(PAGE_SIZE, nextOffset);
      setSubmissions((prev) =>
        nextOffset === 0 ? res.submissions : [...prev, ...res.submissions],
      );
      setTotal(res.total);
      setOffset(nextOffset);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load the review queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDecided(id: string) {
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  function onLogout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          KYC review queue {total > 0 ? `(${total} pending)` : ""}
        </h1>
        <button
          onClick={onLogout}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
        >
          Log out
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {loading && submissions.length === 0 ? (
        <p className="text-slate-500">Loading…</p>
      ) : null}

      {!loading && submissions.length === 0 && !error ? (
        <p className="text-slate-500">No pending submissions.</p>
      ) : null}

      <div className="flex flex-col gap-4">
        {submissions.map((s) => (
          <SubmissionCard key={s.id} submission={s} onDecided={onDecided} />
        ))}
      </div>

      {submissions.length < total ? (
        <button
          onClick={() => load(offset + PAGE_SIZE)}
          disabled={loading}
          className="mt-6 w-full rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @crowdshipping/admin typecheck`
Expected: passes.

- [ ] **Step 4: Verify empty state**

With the dev server running and logged in as the admin (from Task 3), visit `http://localhost:3000/`.
Expected: "KYC review queue" heading (no count shown), "No pending submissions." text, no console errors.

- [ ] **Step 5: Seed a PENDING KYC submission to review**

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nadia.test.smoke@example.com","password":"TestPass123"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -s -X POST http://localhost:4000/kyc/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "documentType": "PASSPORT",
    "documentUrl": "https://example.com/fake-id-front.jpg",
    "selfieUrl": "https://example.com/fake-selfie.jpg",
    "targetLevel": "ENHANCED"
  }'
```

Expected: a `201` response with the created submission (`"status":"PENDING"`). Nadia's account was already at `kycLevel: BASIC` (bumped there during phone verification earlier this session), so `ENHANCED` is a valid step up and the submit call won't hit the "already at or above" `409`.

- [ ] **Step 6: Verify the queue renders the seeded submission**

Reload `http://localhost:3000/` (still logged in as admin).
Expected: one card showing "Nadia TestTraveler", `nadia.test.smoke@example.com`, "Passport · submitted <date>", "Target: Enhanced", and three broken-image placeholders (expected — `example.com` doesn't host real images; this exercises the layout and `alt` fallback, not real S3 delivery, per the design spec's explicit scope note).

- [ ] **Step 7: Approve it and verify the effect**

Click "Approve" on the card.
Expected: the card disappears from the list immediately, no error banner.

Verify the backend effect:

```bash
curl -s http://localhost:4000/kyc/status -H "Authorization: Bearer $TOKEN"
```

Expected: `"kycLevel":"ENHANCED"` in the response (was `BASIC` before approval).

- [ ] **Step 8: Seed and test the reject path**

Repeat Step 5 with a different `documentType` (e.g. `"NATIONAL_ID"`) to create a second `PENDING` submission for the same user — but first downgrade isn't possible, so instead seed it for Karim's account instead (the admin account itself can still have a KYC submission reviewed by admin, since `requireAdmin` only gates who can *review*, not whose submissions exist):

```bash
TOKEN_KARIM=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"karim.test.smoke@example.com","password":"TestPass123"}' \
  | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

curl -s -X POST http://localhost:4000/kyc/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_KARIM" \
  -d '{
    "documentType": "NATIONAL_ID",
    "documentUrl": "https://example.com/fake-id-front-2.jpg",
    "selfieUrl": "https://example.com/fake-selfie-2.jpg",
    "targetLevel": "ENHANCED"
  }'
```

Reload the queue in the browser. Expected: a new card for "Karim Test". Click "Reject" (not "Approve") — a textarea appears. Type a reason (e.g. "Document photo unreadable"), click "Confirm reject".
Expected: the card disappears, no error banner.

Verify:

```bash
curl -s http://localhost:4000/kyc/status -H "Authorization: Bearer $TOKEN_KARIM"
```

Expected: `"kycLevel"` stays at whatever it was before (rejection doesn't bump it), and `"latestSubmission"` shows `"status":"REJECTED"` with `"reviewNote":"Document photo unreadable"`.

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/components/SubmissionCard.tsx apps/admin/app/page.tsx
git commit -m "Add KYC review queue screen"
```

---

## Self-Review Notes

- **Spec coverage:** Architecture (Next.js/TS/Tailwind, localStorage JWT, no refresh, client-side route guard) → Task 1 + Task 3. Login screen with three outcomes → Task 3. Queue screen (list, thumbnails, approve, reject-with-note, load-more, empty state, logout) → Task 5. Error handling (inline messages, button loading/disable states) → folded into Task 3 (login) and Task 5 (queue actions), not a separate task, since a reviewer wouldn't approve either screen without it. Testing (typecheck + manual E2E with a promoted admin and a seeded submission) → Steps in Tasks 3 and 5.
- **Placeholder scan:** none found — every code block is complete; every verification step uses real values (the actual test account emails/passwords already live in this session's dev DB) rather than "REPLACE_ME" placeholders.
- **Type consistency:** `KycSubmission`, `PendingResponse` defined once in Task 4's `kyc.ts` and imported (not redefined) by Task 5's `SubmissionCard.tsx` and `app/page.tsx`. `ApiError`, `apiFetch`, `BASE_URL` defined once in Task 2's `api.ts` and imported everywhere else. `getToken`/`setToken`/`clearToken` defined once in Task 2's `storage.ts`.
