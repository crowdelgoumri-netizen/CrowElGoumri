"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ApiError } from "../../../src/lib/api";
import { getUser, updateUser, type UserDetail } from "../../../src/lib/admin";

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getUser(id);
      setDetail(data);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      setError(e instanceof ApiError ? e.message : "Failed to load user.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onBanToggle() {
    if (!detail) return;
    setActionError(null);
    setAction(detail.user.isBanned ? "unbanning" : "banning");
    try {
      const res = await updateUser(id, { isBanned: !detail.user.isBanned });
      setDetail((prev) => prev && {
        ...prev,
        user: { ...prev.user, isBanned: res.user.isBanned },
      });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Action failed.");
    } finally {
      setAction(null);
    }
  }

  async function onRoleChange(newRole: string) {
    if (!detail) return;
    setActionError(null);
    setAction("changing role");
    try {
      const res = await updateUser(id, { role: newRole });
      setDetail((prev) => prev && {
        ...prev,
        user: { ...prev.user, role: res.user.role },
      });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Action failed.");
    } finally {
      setAction(null);
    }
  }

  if (loading) return <div className="px-6 py-8"><p className="text-slate-500">Loading…</p></div>;
  if (error) return (
    <div className="px-6 py-8">
      <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        <p>{error}</p>
        <button onClick={() => load()} className="mt-1 font-medium underline underline-offset-2">Retry</button>
      </div>
    </div>
  );
  if (!detail) return null;

  const u = detail.user;

  return (
    <div className="px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/users" className="hover:underline">Users</Link> / {u.firstName} {u.lastName}
      </div>

      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        {u.firstName} {u.lastName}
        {u.isBanned && (
          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-sm font-medium text-red-700">
            Banned
          </span>
        )}
      </h1>

      {/* Actions */}
      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</div>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={onBanToggle}
          disabled={action !== null}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            u.isBanned
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-red-600 text-white hover:bg-red-700"
          } disabled:opacity-50`}
        >
          {action === "banning" || action === "unbanning"
            ? "Saving…"
            : u.isBanned
              ? "Unban"
              : "Ban"}
        </button>

        <select
          value={u.role}
          onChange={(e) => onRoleChange(e.target.value)}
          disabled={action !== null}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none disabled:opacity-50"
        >
          <option value="SENDER">Sender</option>
          <option value="TRAVELER">Traveler</option>
          <option value="BOTH">Both</option>
          <option value="AGENT">Agent</option>
        </select>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Profile</h2>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Email" value={u.email} />
            <InfoRow label="Phone" value={u.phone ?? "—"} />
            <InfoRow label="Role" value={u.role} />
            <InfoRow label="KYC Level" value={u.kycLevel} />
            <InfoRow label="KYC Verified" value={u.kycVerifiedAt ? new Date(u.kycVerifiedAt).toLocaleDateString() : "No"} />
            <InfoRow label="Trust Score" value={String(u.trustScore)} />
            <InfoRow label="Stripe Account" value={u.stripeAccountId ? `${u.stripeAccountId.slice(0, 12)}… (${u.stripePayoutsEnabled ? "payouts enabled" : "payouts disabled"})` : "Not connected"} />
            <InfoRow label="Joined" value={new Date(u.createdAt).toLocaleDateString()} />
          </dl>
        </div>

        {/* Activity */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Activity</h2>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Parcels Sent" value={String(u._count.sentParcels)} />
            <InfoRow label="Trips as Traveler" value={String(u._count.travelerTrips)} />
            <InfoRow label="Ratings Received" value={String(u._count.ratingsReceived)} />
            <InfoRow label="Ratings Given" value={String(u._count.ratingsGiven)} />
          </dl>
        </div>

        {/* Escrow */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Escrow Summary</h2>
          <dl className="space-y-2 text-sm">
            <InfoRow label="Total as Sender" value={fmtCurrency(detail.escrowSummary.totalAsSender)} />
            <InfoRow label="Total Received (Traveler)" value={fmtCurrency(detail.escrowSummary.totalReceived)} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-900">{value}</dd>
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
