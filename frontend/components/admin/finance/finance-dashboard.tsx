"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cardClass } from "@/components/admin/form-styles";
import { getFinanceDashboard } from "@/lib/api/finance";
import type { FinanceDashboard as FinanceDashboardData } from "@/lib/api/types";

export function FinanceDashboard() {
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getFinanceDashboard()
      .then(setData)
      .catch(() => setError("Impossible de charger le tableau de bord financier."));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const disbursementRows = Object.entries(data.executed_disbursements_by_project);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Analytique & Reporting</h1>
        <p className="text-sm text-neutral-500">
          Indicateurs simplifiés — pas de marge par projet réelle tant que le revenu n&apos;est pas suivi par
          projet côté Django (voir docs/backend-specifications.md).
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div data-tour="module-finance-dashboard" className={cardClass}>
          <p className="text-xs text-neutral-500">Trésorerie brute (compte 512)</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{data.cash_balance} €</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-neutral-500">Résultat brut (produits − charges)</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{data.gross_result} €</p>
        </div>
        <div className={cardClass}>
          <p className="text-xs text-neutral-500">DSO moyen (délai de paiement)</p>
          <p className="mt-1 text-2xl font-semibold text-neutral-900">
            {data.dso_days !== null ? `${data.dso_days} j` : "—"}
          </p>
        </div>
      </div>

      <div className={cardClass}>
        <p className="mb-3 text-sm font-medium text-neutral-900">Décaissements exécutés par projet</p>
        {disbursementRows.length === 0 ? (
          <p className="text-sm text-neutral-400">Aucun décaissement exécuté pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {disbursementRows.map(([projectId, total]) => (
              <li key={projectId} className="flex justify-between text-neutral-700">
                <span className="text-neutral-400">{projectId}</span>
                <span className="text-neutral-900">{total} €</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
