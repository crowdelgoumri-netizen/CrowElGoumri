"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../src/lib/api";
import { getDashboard, type DashboardStats } from "../src/lib/admin";

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDashboard();
        setStats(data);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Loading stats…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-6 py-8">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Dashboard</h1>
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const totalParcels = Object.values(stats.parcels).reduce((a, b) => a + b, 0);
  const totalTrips = Object.values(stats.trips).reduce((a, b) => a + b, 0);

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={stats.users.total} sub={`+${stats.users.newThisWeek} this week`} />
        <StatCard label="Total parcels" value={totalParcels} sub={Object.entries(stats.parcels).map(([k, v]) => `${k}: ${v}`).join(", ")} />
        <StatCard label="Total trips" value={totalTrips} sub={Object.entries(stats.trips).map(([k, v]) => `${k}: ${v}`).join(", ")} />
        <StatCard label="GMV" value={fmtCurrency(stats.financials.gmv)} sub={`Fees: ${fmtCurrency(stats.financials.platformFees)} · Payouts: ${fmtCurrency(stats.financials.travelerPayouts)}`} />
        <StatCard label="Open disputes" value={stats.openDisputes} />
        <StatCard label="Pending KYC" value={stats.pendingKyc} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub ? (
        <p className="mt-1 truncate text-xs text-slate-400">{sub}</p>
      ) : null}
    </div>
  );
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}
