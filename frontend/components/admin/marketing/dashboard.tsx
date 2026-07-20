"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getMarketingDashboard } from "@/lib/api/marketing";
import type { MarketingDashboard } from "@/lib/api/types";
import { cardClass } from "@/components/admin/form-styles";

const LEAD_STATUS_LABELS: Record<string, string> = {
  NOUVEAU: "Nouveau",
  QUALIFIE: "Qualifié",
  PROPOSITION_EN_COURS: "Proposition en cours",
  PERDU: "Perdu",
  CONVERTI: "Converti",
};

const SOCIAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmé",
  PUBLISHED: "Publié",
  FAILED: "Échec",
  CANCELLED: "Annulé",
};

function formatCurrency(value: string) {
  const n = Number(value);
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

function Breakdown({ title, data, labels }: { title: string; data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data);
  return (
    <div className={cardClass}>
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-neutral-400">Aucune donnée.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(([key, count]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">{labels?.[key] ?? key}</span>
              <span className="font-medium text-neutral-900">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MarketingDashboardView() {
  const [data, setData] = useState<MarketingDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMarketingDashboard()
      .then(setData)
      .catch(() => setError("Impossible de charger le dashboard."));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Dashboard Marketing</h1>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={cardClass}>
          <p className="text-xs text-neutral-500">Pipeline commercial pondéré</p>
          <p className="mt-1 text-2xl font-semibold text-primary">{formatCurrency(data.weighted_pipeline)} €</p>
          <p className="mt-1 text-[0.7rem] text-neutral-400">
            Somme (valeur estimée × score de qualification) sur les leads actifs — nouveau/qualifié/proposition en cours.
          </p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-neutral-500">Leads total</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{data.total_leads}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Breakdown title="Leads par statut" data={data.leads_by_status} labels={LEAD_STATUS_LABELS} />
        <Breakdown title="Leads par source" data={data.leads_by_source} />
        <Breakdown title="Publications par statut" data={data.social_posts_by_status} labels={SOCIAL_STATUS_LABELS} />
        <Breakdown title="Publications publiées par plateforme" data={data.published_social_posts_by_platform} />
      </div>
    </div>
  );
}
