"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../src/lib/api";
import { listUsers, type AdminUser } from "../../src/lib/admin";
import { UserRow } from "../../src/components/UserRow";

const PAGE_SIZE = 20;

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [kycLevel, setKycLevel] = useState("");

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listUsers({
          limit: PAGE_SIZE,
          offset,
          search: search || undefined,
          role: role || undefined,
          kycLevel: kycLevel || undefined,
        });
        setUsers((prev) => (append ? [...prev, ...res.users] : res.users));
        setTotal(res.total);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Failed to load users.");
      } finally {
        setLoading(false);
      }
    },
    [search, role, kycLevel, router],
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  function onFilterChange() {
    setUsers([]);
    load(0, false);
  }

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        Users {total > 0 ? `(${total})` : ""}
      </h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search email, name, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onFilterChange()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setTimeout(onFilterChange, 0);
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">All roles</option>
          <option value="SENDER">Sender</option>
          <option value="TRAVELER">Traveler</option>
          <option value="BOTH">Both</option>
          <option value="AGENT">Agent</option>
        </select>
        <select
          value={kycLevel}
          onChange={(e) => {
            setKycLevel(e.target.value);
            setTimeout(onFilterChange, 0);
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">All KYC levels</option>
          <option value="NONE">None</option>
          <option value="BASIC">Basic</option>
          <option value="ENHANCED">Enhanced</option>
          <option value="FULL">Full</option>
        </select>
        <button
          onClick={onFilterChange}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
        >
          Search
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={() => load(0, false)}
            className="mt-1 font-medium underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && users.length === 0 ? (
        <p className="text-slate-500">Loading…</p>
      ) : null}

      {!loading && total === 0 && !error ? (
        <p className="text-slate-500">No users found.</p>
      ) : null}

      {users.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium uppercase text-slate-400">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">KYC</th>
                <th className="px-4 py-2">Trust</th>
                <th className="px-4 py-2">Activity</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {users.length < total ? (
        <button
          onClick={() => load(users.length, true)}
          disabled={loading}
          className="mt-4 w-full rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : `Load more (${users.length}/${total})`}
        </button>
      ) : null}
    </div>
  );
}
