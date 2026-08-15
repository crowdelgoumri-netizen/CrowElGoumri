"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../../src/lib/api";
import { listParcels, type AdminParcel } from "../../src/lib/admin";
import { ParcelRow } from "../../src/components/ParcelRow";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  "PENDING",
  "MATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
  "DISPUTED",
];

export default function ParcelsPage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<AdminParcel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(
    async (offset: number, append: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const res = await listParcels({
          limit: PAGE_SIZE,
          offset,
          status: status || undefined,
          search: search || undefined,
        });
        setParcels((prev) => (append ? [...prev, ...res.parcels] : res.parcels));
        setTotal(res.total);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        setError(e instanceof ApiError ? e.message : "Failed to load parcels.");
      } finally {
        setLoading(false);
      }
    },
    [search, status, router],
  );

  useEffect(() => {
    load(0, false);
  }, [load]);

  function onFilterChange() {
    setParcels([]);
    load(0, false);
  }

  return (
    <div className="px-6 py-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-900">
        Parcels {total > 0 ? `(${total})` : ""}
      </h1>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onFilterChange()}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setTimeout(onFilterChange, 0);
          }}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
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

      {loading && parcels.length === 0 ? (
        <p className="text-slate-500">Loading…</p>
      ) : null}

      {!loading && total === 0 && !error ? (
        <p className="text-slate-500">No parcels found.</p>
      ) : null}

      {parcels.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium uppercase text-slate-400">
                <th className="px-4 py-2">ID</th>
                <th className="px-4 py-2">Sender</th>
                <th className="px-4 py-2">Description</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Weight</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Traveler</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {parcels.map((p) => (
                <ParcelRow key={p.id} parcel={p} />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {parcels.length < total ? (
        <button
          onClick={() => load(parcels.length, true)}
          disabled={loading}
          className="mt-4 w-full rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : `Load more (${parcels.length}/${total})`}
        </button>
      ) : null}
    </div>
  );
}
