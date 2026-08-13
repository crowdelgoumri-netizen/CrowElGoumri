"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../lib/api";
import { reviewSubmission, type KycSubmission } from "../lib/kyc";

/** Only allow http(s) URLs through — blocks javascript:/data:/etc. XSS vectors. */
function safeUrl(u: string): string | undefined {
  try {
    const p = new URL(u).protocol;
    return p === "http:" || p === "https:" ? u : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Thumbnail for a submission's document/selfie photo. Only wraps the image
 * in a clickable link when the URL is a safe http(s) URL — otherwise it
 * renders the (broken-image) thumbnail without a link, so an attacker-
 * controlled `javascript:` URL can never end up in a clicked href.
 */
function Thumbnail({ url, alt }: { url: string; alt: string }) {
  const safe = safeUrl(url);
  const img = (
    <img
      src={safe ?? url}
      alt={alt}
      className="h-24 w-24 rounded-md border border-slate-200 object-cover"
    />
  );
  if (!safe) return img;
  return (
    <a href={safe} target="_blank" rel="noreferrer">
      {img}
    </a>
  );
}

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
  const router = useRouter();
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
      if (e instanceof ApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
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
        <Thumbnail url={submission.documentUrl} alt="Document photo unavailable" />
        {submission.documentBackUrl ? (
          <Thumbnail url={submission.documentBackUrl} alt="Document back photo unavailable" />
        ) : null}
        <Thumbnail url={submission.selfieUrl} alt="Selfie photo unavailable" />
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
