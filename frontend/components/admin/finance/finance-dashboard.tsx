"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cardClass } from "@/components/admin/form-styles";
import { getFinanceDashboard } from "@/lib/api/finance";
import { formatFcfa } from "@/lib/format-currency";
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
          <p className="mt-1 text-2xl font-semibold text-neutral-900">{formatFcfa(data.cash_balance)}</p>
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

      {data.taxes && (
        <div className={`${cardClass} mb-6`}>
          <p className="mb-1 text-sm font-medium text-neutral-900">Taxes collectées sur les factures</p>
          <p className="mb-4 text-xs text-neutral-400">Factures émises (hors brouillons) — montants dus à l&apos;État.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {([
              [`Année ${data.taxes.year}`, data.taxes.this_year],
              ["Depuis le début", data.taxes.all_time],
            ] as const).map(([label, t]) => (
              <div key={label} className="rounded-lg border border-neutral-100 p-4">
                <p className="mb-2 text-xs font-semibold tracking-wide text-neutral-500 uppercase">
                  {label} · {t.invoices} facture{t.invoices > 1 ? "s" : ""}
                </p>
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-neutral-500">Montant HT</dt><dd className="text-neutral-900">{formatFcfa(t.amount_ht)}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500">TVA</dt><dd className="text-neutral-900">{formatFcfa(t.vat)}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500">CSS</dt><dd className="text-neutral-900">{formatFcfa(t.css)}</dd></div>
                  {Object.entries(t.extra).map(([name, amount]) => (
                    <div key={name} className="flex justify-between"><dt className="text-neutral-500">{name}</dt><dd className="text-neutral-900">{formatFcfa(amount)}</dd></div>
                  ))}
                  <div className="flex justify-between border-t border-neutral-100 pt-1.5 font-semibold"><dt className="text-neutral-900">Total des taxes</dt><dd className="text-neutral-900">{formatFcfa(t.total_taxes)}</dd></div>
                  <div className="flex justify-between text-xs"><dt className="text-neutral-400">Montant TTC facturé</dt><dd className="text-neutral-500">{formatFcfa(t.amount_ttc)}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}

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
