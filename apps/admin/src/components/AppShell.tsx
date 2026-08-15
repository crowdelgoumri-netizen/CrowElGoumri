"use client";

/**
 * Top-level layout: sidebar on authenticated pages, no sidebar on /login.
 * Separate client component (from app/layout.tsx) so we can use usePathname —
 * the root layout itself must stay a Server Component for the `metadata` export.
 */
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
    </div>
  );
}
