"use client";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700",
  MATCHED: "bg-blue-50 text-blue-700",
  IN_TRANSIT: "bg-indigo-50 text-indigo-700",
  DELIVERED: "bg-green-50 text-green-700",
  CANCELLED: "bg-slate-100 text-slate-500",
  DISPUTED: "bg-red-50 text-red-700",
};

export function ParcelRow({ parcel }: { parcel: import("../lib/admin").AdminParcel }) {
  return (
    <tr className="border-b border-slate-100 text-sm">
      <td className="py-2 pr-4 font-mono text-xs text-slate-400">
        {parcel.id.slice(0, 8)}
      </td>
      <td className="py-2 pr-4">
        <span className="text-slate-900">
          {parcel.sender.firstName} {parcel.sender.lastName}
        </span>
      </td>
      <td className="max-w-[200px] truncate py-2 pr-4 text-slate-600">
        {parcel.description}
      </td>
      <td className="py-2 pr-4">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_COLORS[parcel.status] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {parcel.status}
        </span>
      </td>
      <td className="py-2 pr-4 text-slate-600">{parcel.category ?? "—"}</td>
      <td className="py-2 pr-4 text-slate-600">{parcel.weightKg} kg</td>
      <td className="py-2 pr-4 text-slate-600">
        {parcel.offeredPrice != null
          ? `${parcel.offeredPrice.toFixed(2)} ${parcel.currency}`
          : "—"}
      </td>
      <td className="py-2 text-slate-500">
        {parcel.matchedTrip?.traveler
          ? `${parcel.matchedTrip.traveler.firstName} ${parcel.matchedTrip.traveler.lastName}`
          : "—"}
      </td>
      <td className="py-2 pl-2 text-slate-400">
        {new Date(parcel.createdAt).toLocaleDateString()}
      </td>
    </tr>
  );
}
