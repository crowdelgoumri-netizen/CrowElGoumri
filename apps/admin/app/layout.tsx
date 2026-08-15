import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "../src/components/AuthGate";
import { Sidebar } from "../src/components/Sidebar";

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
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}

/**
 * Top-level layout: sidebar on authenticated pages, no sidebar on /login.
 * Must be a separate client component so we can use usePathname.
 */
import { usePathname } from "next/navigation";

function AppShell({ children }: { children: React.ReactNode }) {
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
