"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadInvoicePdf, listInvoices, validateInvoice } from "@/lib/api/finance";
import { InvoicePayments } from "@/components/admin/finance/invoice-payments";
import { formatFcfa } from "@/lib/format-currency";
import type { Invoice } from "@/lib/api/types";

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await listInvoices();
      setInvoices(res.results);
    } catch {
      setError("Impossible de charger les factures.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleValidate(id: string) {
    setActingId(id);
    setActionError(null);
    try {
      await validateInvoice(id);
      await load();
    } catch {
      setActionError("Validation impossible — vérifie qu'une période comptable ouverte couvre la date de facture.");
    } finally {
      setActingId(null);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!invoices) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Facturation</h1>
          <p className="text-sm text-neutral-500">Validation finale des factures et écriture de régularisation automatique.</p>
        </div>
        <Link href="/admin/finance/facturation/nouveau">
          <Button data-tour="module-finance-facturation" className="gap-1.5 rounded-full px-4">
            <Plus className="size-4" /> Nouvelle facture
          </Button>
        </Link>
      </div>

      {actionError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {actionError}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
        <table className="table-responsive w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Montant TTC</th>
              <th className="px-4 py-3 font-medium">Reste à payer</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="w-32 px-4 py-3 font-medium">Versements</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {invoices.map((invoice) => (
              <Fragment key={invoice.id}>
              <tr>
                <td className="px-4 py-3 text-neutral-900" data-label="N°">
                  <Link href={`/admin/finance/facturation/${invoice.id}`} className="hover:text-primary hover:underline">
                    {invoice.invoice_number}
                  </Link>
                  {invoice.quote_number && <span className="ml-1.5 text-xs text-neutral-400">{invoice.quote_number}</span>}
                </td>
                <td className="px-4 py-3 text-neutral-700" data-label="Client">{invoice.client_name}</td>
                <td className="px-4 py-3 text-neutral-900" data-label="Montant TTC">{formatFcfa(invoice.amount_ttc)}</td>
                <td className="px-4 py-3" data-label="Reste à payer">
                  {Number(invoice.amount_ttc) - Number(invoice.amount_paid) <= 0 ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Payée</span>
                  ) : (
                    <span className="text-neutral-900">{formatFcfa(Number(invoice.amount_ttc) - Number(invoice.amount_paid))}</span>
                  )}
                </td>
                <td className="px-4 py-3" data-label="Statut">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    invoice.status === "VALIDEE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  }`}>
                    {invoice.status === "VALIDEE" ? "Validée" : "Brouillon"}
                  </span>
                </td>
                <td className="px-4 py-3" data-label="Action">
                  <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/finance/facturation/${invoice.id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
                  >
                    <Pencil className="size-3" /> {invoice.status === "BROUILLON" ? "Modifier" : "Ouvrir"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => downloadInvoicePdf(invoice.id, invoice.invoice_number).catch((err: Error) => setActionError(err.message))}
                    className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
                  >
                    <Download className="size-3" /> PDF
                  </button>
                  {invoice.status === "BROUILLON" && (
                    <button
                      disabled={actingId === invoice.id}
                      onClick={() => handleValidate(invoice.id)}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary disabled:opacity-40"
                    >
                      Valider
                    </button>
                  )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId((id) => (id === invoice.id ? null : invoice.id))}
                    className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"
                  >
                    <ChevronDown
                      className={`size-3.5 transition-transform ${expandedId === invoice.id ? "rotate-180" : ""}`}
                    />
                    {expandedId === invoice.id ? "Masquer" : "Voir"}
                  </button>
                </td>
              </tr>
              {expandedId === invoice.id && (
                <tr>
                  <td colSpan={7} className="bg-neutral-50/60 px-4 py-5">
                    <InvoicePayments invoice={invoice} />
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-neutral-400">Aucune facture pour l&apos;instant.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
