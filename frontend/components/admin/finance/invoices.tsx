"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Download, Eye, LayoutGrid, List, Loader2, MoreHorizontal, Pencil, Plus, Search, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { QuoteSettingsForm } from "@/components/admin/marketing/quote-list";
import { inputClass } from "@/components/admin/form-styles";
import { InvoiceViewer } from "@/components/admin/finance/invoice-viewer";
import { TaxRatesForm } from "@/components/admin/finance/tax-rates-form";
import { downloadInvoicePdf, getInvoiceEditorContext, listInvoices, validateInvoice, type InvoiceEditorContext } from "@/lib/api/finance";
import { formatFcfa } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/api/types";

type StatusFilter = "TOUS" | "BROUILLON" | "VALIDEE";
type PaymentFilter = "TOUS" | "A_PAYER" | "PAYEE";

const due = (invoice: Invoice) => Math.max(Number(invoice.amount_ttc) - Number(invoice.amount_paid), 0);
const clientOf = (invoice: Invoice) => invoice.client_name || "Sans client";

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [context, setContext] = useState<InvoiceEditorContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("TOUS");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("TOUS");
  const [view, setView] = useState<"liste" | "clients">("liste");

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
    // Coordonnées de la société pour l'aperçu du panneau « Voir ».
    getInvoiceEditorContext().then(setContext).catch(() => setContext(null));
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

  function downloadPdf(invoice: Invoice) {
    downloadInvoicePdf(invoice.id, invoice.invoice_number).catch((err: Error) => setActionError(err.message));
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (invoices ?? []).filter((invoice) => {
      if (statusFilter !== "TOUS" && invoice.status !== statusFilter) return false;
      if (paymentFilter === "A_PAYER" && due(invoice) <= 0) return false;
      if (paymentFilter === "PAYEE" && due(invoice) > 0) return false;
      if (!q) return true;
      return [invoice.invoice_number, invoice.client_name, invoice.quote_number ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [invoices, query, statusFilter, paymentFilter]);

  const byClient = useMemo(() => {
    const groups = new Map<string, Invoice[]>();
    for (const invoice of filtered) groups.set(clientOf(invoice), [...(groups.get(clientOf(invoice)) ?? []), invoice]);
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"));
  }, [filtered]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!invoices) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const viewing = invoices.find((i) => i.id === viewingId) ?? null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Facturation</h1>
          <p className="text-sm text-neutral-500">Validation finale des factures et écriture de régularisation automatique.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            aria-label="Paramètres des documents"
            title="Paramètres des documents (coordonnées, cachet / signature, moyens de paiement)"
            className="size-9 rounded-full p-0"
          >
            <Settings className="size-4" />
          </Button>
          <Link href="/admin/finance/facturation/nouveau">
            <Button data-tour="module-finance-facturation" className="gap-1.5 rounded-full px-4">
              <Plus className="size-4" /> Nouvelle facture
            </Button>
          </Link>
        </div>
      </div>

      {/* Mêmes paramètres que les devis : coordonnées, cachet / signature,
        * moyens de paiement — utilisés aussi par les factures et les reçus. */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent title="Paramètres des documents">
          <TaxRatesForm />
          <QuoteSettingsForm
            onSaved={() => {
              setSettingsOpen(false);
              getInvoiceEditorContext().then(setContext).catch(() => {});
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Recherche, filtres et choix de la vue */}
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un n° de facture, un client, un devis…"
            aria-label="Rechercher"
            className={cn(inputClass, "pl-9")}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} className={cn(inputClass, "w-auto")} aria-label="Statut">
            <option value="TOUS">Tous les statuts</option>
            <option value="BROUILLON">Brouillons</option>
            <option value="VALIDEE">Validées</option>
          </select>
          <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)} className={cn(inputClass, "w-auto")} aria-label="Paiement">
            <option value="TOUS">Tous les paiements</option>
            <option value="A_PAYER">Reste à payer</option>
            <option value="PAYEE">Payées</option>
          </select>
          <div className="flex items-center rounded-full border border-neutral-200 p-0.5">
            {([
              ["liste", List, "Vue liste"],
              ["clients", LayoutGrid, "Vue par client"],
            ] as const).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                aria-label={label}
                aria-pressed={view === value}
                title={label}
                className={cn("flex size-8 items-center justify-center rounded-full", view === value ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100")}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {actionError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {actionError}
        </p>
      )}

      {view === "liste" ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
          <table className="table-responsive w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Montant TTC</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Reste à payer</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((invoice) => (
                // Toute la ligne ouvre le panneau « Voir » ; le menu « ⋯ » arrête le clic.
                <tr key={invoice.id} onClick={() => setViewingId(invoice.id)} className="cursor-pointer transition-colors hover:bg-neutral-50">
                  <td className="px-4 py-3 text-neutral-900" data-label="N°">
                    <span className="whitespace-nowrap font-medium">{invoice.invoice_number}</span>
                    {invoice.quote_number && <span className="block text-xs text-neutral-400">{invoice.quote_number}</span>}
                  </td>
                  <td className="px-4 py-3 text-neutral-700" data-label="Client">{clientOf(invoice)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-neutral-900" data-label="Montant TTC">{formatFcfa(invoice.amount_ttc)}</td>
                  <td className="px-4 py-3 whitespace-nowrap" data-label="Reste à payer">
                    <DueBadge invoice={invoice} />
                  </td>
                  <td className="px-4 py-3" data-label="Statut">
                    <StatusBadge invoice={invoice} />
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <ActionsMenu invoice={invoice} acting={actingId === invoice.id} onView={() => setViewingId(invoice.id)} onPdf={() => downloadPdf(invoice)} onValidate={() => handleValidate(invoice.id)} />
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                    {invoices.length === 0 ? "Aucune facture pour l'instant." : "Aucune facture ne correspond à la recherche."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {byClient.map(([client, list]) => {
            const total = list.reduce((sum, i) => sum + Number(i.amount_ttc), 0);
            const remaining = list.reduce((sum, i) => sum + due(i), 0);
            return (
              <div key={client} className="flex flex-col rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate font-semibold text-neutral-900" title={client}>{client}</p>
                  <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                    {list.length} facture{list.length > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-500">
                  <span>Facturé <span className="font-medium whitespace-nowrap text-neutral-900">{formatFcfa(total)}</span></span>
                  <span>
                    Reste{" "}
                    <span className={cn("font-medium whitespace-nowrap", remaining > 0 ? "text-amber-700" : "text-emerald-700")}>{formatFcfa(remaining)}</span>
                  </span>
                </div>
                <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
                  {list.map((invoice) => (
                    <li key={invoice.id}>
                      <button
                        type="button"
                        onClick={() => setViewingId(invoice.id)}
                        className="flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-primary"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{invoice.invoice_number}</span>
                          <span className="text-xs text-neutral-400">
                            {new Date(invoice.issue_date).toLocaleDateString("fr-FR")}
                            {invoice.quote_number ? ` · ${invoice.quote_number}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block whitespace-nowrap">{formatFcfa(invoice.amount_ttc)}</span>
                          <DueBadge invoice={invoice} small />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {byClient.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-400">
              {invoices.length === 0 ? "Aucune facture pour l'instant." : "Aucune facture ne correspond à la recherche."}
            </p>
          )}
        </div>
      )}

      <InvoiceViewer
        invoice={viewing}
        settings={context?.settings ?? null}
        onClose={() => setViewingId(null)}
        onChanged={load}
        onPdf={() => viewing && downloadPdf(viewing)}
      />
    </div>
  );
}

function StatusBadge({ invoice }: { invoice: Invoice }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs whitespace-nowrap", invoice.status === "VALIDEE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
      {invoice.status === "VALIDEE" ? "Validée" : "Brouillon"}
    </span>
  );
}

function DueBadge({ invoice, small }: { invoice: Invoice; small?: boolean }) {
  const remaining = due(invoice);
  if (remaining <= 0) {
    return <span className={cn("rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700", small ? "text-[11px]" : "text-xs")}>Payée</span>;
  }
  return <span className={cn("whitespace-nowrap text-neutral-900", small && "text-xs text-amber-700")}>{small ? `Reste ${formatFcfa(remaining)}` : formatFcfa(remaining)}</span>;
}

/** Actions d'une facture, dans un menu « ⋯ » comme pour les devis. */
function ActionsMenu({ invoice, acting, onView, onPdf, onValidate }: { invoice: Invoice; acting: boolean; onView: () => void; onPdf: () => void; onValidate: () => void }) {
  const item = "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50";
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Actions de la facture ${invoice.invoice_number}`}
            className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <MoreHorizontal className="size-4" />
          </button>
        }
      />
      <PopoverContent className="w-52 p-1" align="end">
        <button type="button" onClick={onView} className={item}>
          <Eye className="size-3.5" /> Voir et versements
        </button>
        {invoice.status === "BROUILLON" && (
          <Link href={`/admin/finance/facturation/${invoice.id}`} className={item}>
            <Pencil className="size-3.5" /> Modifier
          </Link>
        )}
        <button type="button" onClick={onPdf} className={item}>
          <Download className="size-3.5" /> Télécharger le PDF
        </button>
        {invoice.status === "BROUILLON" && (
          <button type="button" disabled={acting} onClick={onValidate} className={cn(item, "text-primary disabled:opacity-40")}>
            <CheckCircle2 className="size-3.5" /> Valider
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
