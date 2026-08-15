"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SubmissionCard } from "../../src/components/SubmissionCard";
import { ApiError } from "../../src/lib/api";
import { listPending, type KycSubmission } from "../../src/lib/kyc";

const PAGE_SIZE = 20;

export default function KycPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [total, setTotal] = useState(0);
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
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      setError(e instanceof ApiError ? e.message : "Failed to load the review queue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loading && !error && submissions.length === 0 && total > 0) {
      load(submissions.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions.length, total, loading, error]);

  function onDecided(id: string) {
    setSubmissions((prev) => prev.filter((s) => s.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          KYC review queue {total > 0 ? `(${total} pending)` : ""}
        </h1>
      </div>

      {error ? (
        <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          <p>{error}</p>
          {submissions.length === 0 ? (
            <button
              onClick={() => load(0)}
              className="mt-1 font-medium underline underline-offset-2"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {loading && submissions.length === 0 ? (
        <p className="text-slate-500">Loading…</p>
      ) : null}

      {!loading && total === 0 && !error ? (
        <p className="text-slate-500">No pending submissions.</p>
      ) : null}

      <div className="flex flex-col gap-4">
        {submissions.map((s) => (
          <SubmissionCard key={s.id} submission={s} onDecided={onDecided} />
        ))}
      </div>

      {submissions.length < total ? (
        <button
          onClick={() => load(submissions.length)}
          disabled={loading}
          className="mt-6 w-full rounded-md border border-slate-300 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
