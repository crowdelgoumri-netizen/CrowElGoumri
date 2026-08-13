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
