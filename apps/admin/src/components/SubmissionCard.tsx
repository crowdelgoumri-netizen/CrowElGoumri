"use client";

import { useState } from "react";
import { ApiError } from "../lib/api";
import { reviewSubmission, type KycSubmission } from "../lib/kyc";

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
        <a href={submission.documentUrl} target="_blank" rel="noreferrer">
          <img
            src={submission.documentUrl}
            alt="Document photo unavailable"
            className="h-24 w-24 rounded-md border border-slate-200 object-cover"
          />
        </a>
        {submission.documentBackUrl ? (
          <a href={submission.documentBackUrl} target="_blank" rel="noreferrer">
            <img
              src={submission.documentBackUrl}
              alt="Document back photo unavailable"
              className="h-24 w-24 rounded-md border border-slate-200 object-cover"
            />
          </a>
        ) : null}
        <a href={submission.selfieUrl} target="_blank" rel="noreferrer">
          <img
            src={submission.selfieUrl}
            alt="Selfie photo unavailable"
            className="h-24 w-24 rounded-md border border-slate-200 object-cover"
          />
        </a>
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
