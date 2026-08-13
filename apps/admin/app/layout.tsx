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
