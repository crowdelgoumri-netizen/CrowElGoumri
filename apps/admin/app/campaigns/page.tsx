"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  listAdminCampaigns,
  patchAdminCampaign,
  type AdminCampaign,
  type CampaignStatus,
} from "../../src/lib/campaigns";
import { ApiError } from "../../src/lib/api";

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Active",
  ARCHIVED: "Archivée",
};

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: "bg-yellow-100 text-yellow-800",
  ACTIVE: "bg-green-100 text-green-800",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "">("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdminCampaigns({
        status: statusFilter || undefined,
        limit: 50,
      });
      setCampaigns(res.campaigns);
      setTotal(res.total);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) { router.replace("/login"); return; }
      setError(e instanceof ApiError ? e.message : "Impossible de charger les campagnes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function toggleFeatured(c: AdminCampaign) {
    try {
      const res = await patchAdminCampaign(c.id, { featured: !c.featured });
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? res.campaign as AdminCampaign : x)));
    } catch {}
  }

  async function setStatus(c: AdminCampaign, status: CampaignStatus) {
    try {
      const res = await patchAdminCampaign(c.id, { status });
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? res.campaign as AdminCampaign : x)));
    } catch {}
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Campagnes transporteurs {total > 0 ? `(${total})` : ""}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gérez les annonces des voyageurs réguliers. Épinglez les plus fiables.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | "")}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actives</option>
          <option value="DRAFT">Brouillons</option>
          <option value="ARCHIVED">Archivées</option>
        </select>
      </div>

      {loading && (
        <p className="text-slate-500 text-sm">Chargement…</p>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && campaigns.length === 0 && !error && (
        <p className="text-slate-500 text-sm">Aucune campagne pour ce filtre.</p>
      )}

      <div className="space-y-3">
        {campaigns.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-slate-200 bg-white p-4 flex gap-4 items-start"
          >
            {/* Left: info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                  {STATUS_LABELS[c.status]}
                </span>
                {c.featured && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    ★ Épinglé
                  </span>
                )}
              </div>
              <p className="font-semibold text-slate-900 text-sm truncate">{c.title}</p>
              <p className="text-slate-500 text-xs mt-0.5">
                {c.originCity} ({c.originCountry}) → {c.destWilayas.slice(0, 3).join(", ")}
                {c.destWilayas.length > 3 ? ` +${c.destWilayas.length - 3}` : ""}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Départ {new Date(c.departureDate).toLocaleDateString("fr-FR")}
                {c.returnDate ? ` · Retour ${new Date(c.returnDate).toLocaleDateString("fr-FR")}` : " · Aller simple"}
                {" · "}{c.capacityKg} kg · {c.pricePerKg} €/kg · {c.mode}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Transporteur : {c.traveler.firstName} {c.traveler.lastName} — {c.traveler.email}
              </p>
            </div>

            {/* Right: actions */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => toggleFeatured(c)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  c.featured
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {c.featured ? "★ Épinglé" : "Épingler"}
              </button>
              {c.status === "ACTIVE" && (
                <button
                  onClick={() => setStatus(c, "ARCHIVED")}
                  className="text-xs px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 font-medium"
                >
                  Archiver
                </button>
              )}
              {c.status === "ARCHIVED" && (
                <button
                  onClick={() => setStatus(c, "ACTIVE")}
                  className="text-xs px-3 py-1.5 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                >
                  Réactiver
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
