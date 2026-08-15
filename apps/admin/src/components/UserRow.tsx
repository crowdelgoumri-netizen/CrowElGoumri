"use client";

import Link from "next/link";

const ROLE_COLORS: Record<string, string> = {
  SENDER: "bg-blue-50 text-blue-700",
  TRAVELER: "bg-green-50 text-green-700",
  BOTH: "bg-purple-50 text-purple-700",
  AGENT: "bg-amber-50 text-amber-700",
};

const KYC_COLORS: Record<string, string> = {
  NONE: "bg-slate-100 text-slate-500",
  BASIC: "bg-yellow-50 text-yellow-700",
  ENHANCED: "bg-blue-50 text-blue-700",
  FULL: "bg-green-50 text-green-700",
};

export function UserRow({ user }: { user: import("../lib/admin").AdminUser }) {
  return (
    <tr className="border-b border-slate-100 text-sm">
      <td className="py-2 pr-4">
        <Link
          href={`/users/${user.id}`}
          className="font-medium text-slate-900 hover:underline"
        >
          {user.firstName} {user.lastName}
        </Link>
      </td>
      <td className="py-2 pr-4 text-slate-600">{user.email}</td>
      <td className="py-2 pr-4">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            ROLE_COLORS[user.role] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {user.role}
        </span>
      </td>
      <td className="py-2 pr-4">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            KYC_COLORS[user.kycLevel] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {user.kycLevel}
        </span>
      </td>
      <td className="py-2 pr-4 text-slate-600">{user.trustScore}</td>
      <td className="py-2 text-slate-500">
        {user._count.sentParcels}P · {user._count.travelerTrips}T
      </td>
      <td className="py-2 pl-2">
        {user.isBanned && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
            Banned
          </span>
        )}
      </td>
    </tr>
  );
}
