"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { DocumentPreviewCards } from "@/components/admin/marketing/document-preview-cards";
import { DOCUMENT_COLOR_SWATCHES } from "@/components/admin/marketing/document-print-primitives";
import { InvoiceDocument, invoiceTotals } from "@/components/admin/finance/invoice-document";
import { SendInvoiceModal } from "@/components/admin/finance/invoice-viewer";
import { ApiError } from "@/lib/api/client";
import {
  createInvoice,
  downloadInvoicePdf,
  getInvoiceEditorContext,
  markInvoicePaid,
  updateInvoice,
  type InvoiceEditorContext,
  type InvoiceInput,
} from "@/lib/api/finance";
import { formatFcfa } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import type { Invoice, InvoiceLine } from "@/lib/api/types";

const BASE_PATH = "/admin/finance/facturation";
const EMPTY_LINE: InvoiceLine = { description: "", quantity: "1", unit_price: "", note: "" };
const PAYMENT_METHODS = [
  { value: "ESPECES", label: "Espèces" },
  { value: "VIREMENT", label: "Virement" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "CARTE", label: "Carte bancaire" },
  { value: "AUTRE", label: "Autre (Mobile Money…)" },
];

function errorDetail(err: unknown) {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== "object") return null;
  const body = err.body as Record<string, unknown>;
  if (typeof body.detail === "string") return body.detail;
  const first = Object.values(body)[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  return typeof first === "string" ? first : null;
}

/** Facture : formulaire à gauche, aperçu à droite (même document que le PDF).
 * Une facture peut reprendre un devis — ses lignes, ou une ligne par acompte
 * de son échéancier — en gardant le lien avec lui ; une réduction s'ajoute à
 * part des lignes pour garder la trace de l'écart avec le devis. */
export function InvoiceEditor({ invoice }: { invoice?: Invoice }) {
  const router = useRouter();
  const [context, setContext] = useState<InvoiceEditorContext | null>(null);
  const [current, setCurrent] = useState<Invoice | undefined>(invoice);
  const locked = current?.status === "VALIDEE";

  const [clientName, setClientName] = useState(invoice?.client_name ?? "");
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [lines, setLines] = useState<InvoiceLine[]>(invoice?.lines.length ? invoice.lines : [{ ...EMPTY_LINE }]);
  const [discount, setDiscount] = useState(invoice && Number(invoice.discount_amount) ? String(Math.round(Number(invoice.discount_amount))) : "");
  const [discountReason, setDiscountReason] = useState(invoice?.discount_reason ?? "");
  // Taux dynamiques : ceux de la facture, sinon ceux des paramètres
  // Finance (chargés avec le contexte de l'éditeur), ajustables ici.
  const [vatPercent, setVatPercent] = useState(invoice ? String(Math.round(Number(invoice.vat_rate) * 1000) / 10) : "");
  // Autres taxes appliquées (en plus de la TVA et de la CSS) ; une nouvelle
  // facture reprend celles cochées d'office dans les paramètres Finance.
  const [extraTaxes, setExtraTaxes] = useState<{ name: string; percent: string }[]>(
    (invoice?.extra_taxes ?? []).map(({ name, percent }) => ({ name, percent })),
  );
  const [cssPercent, setCssPercent] = useState(
    invoice?.css_rate !== undefined ? String(Math.round(Number(invoice.css_rate) * 1000) / 10) : "",
  );
  const [documentColor, setDocumentColor] = useState(invoice?.document_color ?? "#123f91");
  const [quoteId, setQuoteId] = useState<string | null>(invoice?.quote ?? null);
  const [pickedQuote, setPickedQuote] = useState("");

  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState("ESPECES");
  const [sendOpen, setSendOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoiceEditorContext()
      .then((ctx) => {
        setContext(ctx);
        if (ctx.tax_rates) {
          const pct = (rate: string) => String(Math.round(Number(rate) * 1000) / 10);
          setVatPercent((v) => (v === "" ? pct(ctx.tax_rates!.vat_rate) : v));
          setCssPercent((v) => (v === "" ? pct(ctx.tax_rates!.css_rate) : v));
          if (!invoice) {
            setExtraTaxes((ctx.tax_rates.extra_taxes ?? []).filter((t) => t.enabled).map(({ name, percent }) => ({ name, percent })));
          }
        }
      })
      .catch(() => setError("Impossible de charger les devis et les coordonnées de la société."));
  }, [invoice]);

  const quote = context?.quotes.find((q) => q.id === pickedQuote);
  const linkedQuoteNumber = context?.quotes.find((q) => q.id === quoteId)?.quote_number ?? current?.quote_number ?? null;
  const vatRate = (Number(vatPercent) || 0) / 100;
  const cssRate = (Number(cssPercent) || 0) / 100;
  const paid = Number(current?.amount_paid ?? 0);
  const totals = invoiceTotals(lines, Number(discount) || 0, vatRate, paid, cssRate, extraTaxes);
  // Autres taxes proposées : celles des paramètres, plus celles déjà sur la facture.
  const extraChoices = [
    ...(context?.tax_rates?.extra_taxes ?? []).map(({ name, percent }) => ({ name, percent })),
    ...extraTaxes.filter((t) => !(context?.tax_rates?.extra_taxes ?? []).some((s) => s.name === t.name)),
  ];

  const preview = useMemo(
    () => ({
      invoice_number: current?.invoice_number ?? "",
      client_name: clientName,
      issue_date: issueDate,
      lines,
      discount_amount: Number(discount) || 0,
      discount_reason: discountReason,
      vat_rate: vatRate,
      css_rate: cssRate,
      extra_taxes: extraTaxes,
      amount_paid: paid,
      quote_number: linkedQuoteNumber,
    }),
    [current?.invoice_number, clientName, issueDate, lines, discount, discountReason, vatRate, cssRate, extraTaxes, paid, linkedQuoteNumber],
  );

  function confirmReplace() {
    const hasContent = lines.some((l) => l.description || Number(l.unit_price));
    return !hasContent || window.confirm("Remplacer les lignes actuelles par celles du devis ?");
  }

  /** Reprend les prestations du devis ; sa remise devient la réduction. */
  function importQuoteLines() {
    if (!quote || !confirmReplace()) return;
    setLines(quote.lines.map((l) => ({ ...l, note: "" })));
    setDiscount(Number(quote.discount_amount) ? String(Math.round(Number(quote.discount_amount))) : "");
    setDiscountReason(Number(quote.discount_amount) ? `remise du devis ${quote.quote_number}` : "");
    applyQuote();
  }

  /** Une ligne par échéance du devis (acomptes), calculée sur son total. */
  function importQuoteTerms() {
    if (!quote || !confirmReplace()) return;
    const total = Number(quote.total) || 0;
    setLines(
      quote.payment_terms.map((term) => ({
        description: term.label,
        quantity: "1",
        unit_price: String(Math.round((total * term.percentage) / 100)),
        note: `soit ${term.percentage} % du montant total`,
      })),
    );
    // Les acomptes sont calculés sur le total déjà remisé.
    setDiscount("");
    setDiscountReason("");
    applyQuote();
  }

  function applyQuote() {
    if (!quote) return;
    setQuoteId(quote.id);
    if (quote.client_name) setClientName(quote.client_name);
    if (quote.document_color) setDocumentColor(quote.document_color);
  }

  function updateLine(index: number, patch: Partial<InvoiceLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data: InvoiceInput = {
      client_name: clientName.trim(),
      issue_date: issueDate,
      due_date: dueDate || null,
      lines: lines.filter((l) => l.description.trim() || Number(l.unit_price)),
      discount_amount: discount ? String(Number(discount)) : "0",
      discount_reason: discountReason.trim(),
      vat_rate: String(vatRate),
      css_rate: String(cssRate),
      extra_taxes: extraTaxes,
      document_color: documentColor,
      quote: quoteId,
    };
    try {
      if (current) await updateInvoice(current.id, data);
      else await createInvoice(data);
      router.push(BASE_PATH);
    } catch (err) {
      setError(errorDetail(err) ?? "Enregistrement impossible — vérifiez le client et les lignes.");
      setSaving(false);
    }
  }

  async function handleMarkPaid() {
    if (!current) return;
    if (!window.confirm(`Enregistrer ${formatFcfa(totals.due)} comme reçu et solder la facture ?`)) return;
    setPaying(true);
    setError(null);
    try {
      setCurrent(await markInvoicePaid(current.id, payMethod));
    } catch (err) {
      setError(errorDetail(err) ?? "Impossible de marquer la facture comme payée.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div>
      <Link href={BASE_PATH} className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="size-3.5" /> Facturation
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {current ? `Facture ${current.invoice_number}` : "Nouvelle facture"}
        </h1>
        {current && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setSendOpen(true)} className="gap-1.5 rounded-full px-4">
              <Mail className="size-4" /> Envoyer par mail
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadInvoicePdf(current.id, current.invoice_number).catch((err: Error) => setError(err.message))}
              className="gap-1.5 rounded-full px-4"
            >
              <Download className="size-4" /> Télécharger le PDF
            </Button>
            <SendInvoiceModal invoice={current} open={sendOpen} onOpenChange={setSendOpen} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <form onSubmit={handleSave} className="min-w-0 space-y-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">{error}</p>
          )}
          {locked && (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">
              Facture validée : son contenu ne peut plus être modifié. Vous pouvez toujours enregistrer son paiement et la télécharger.
            </p>
          )}

          {current && (
            <PaymentStatus
              totals={totals}
              canPay={!!current && current.status !== "BROUILLON" && totals.due > 0}
              payMethod={payMethod}
              onPayMethod={setPayMethod}
              paying={paying}
              onMarkPaid={handleMarkPaid}
            />
          )}

          <fieldset disabled={locked} className="space-y-5">
            {/* Récupérer un devis */}
            {context && context.quotes.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                  <FileText className="size-4 text-primary" /> Récupérer un devis
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Reprend le client, la couleur et les prestations du devis{linkedQuoteNumber ? ` (lié : ${linkedQuoteNumber})` : ""}.
                </p>
                <select value={pickedQuote} onChange={(e) => setPickedQuote(e.target.value)} className={cn(inputClass, "mt-2.5")}>
                  <option value="">Choisir un devis…</option>
                  {context.quotes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.quote_number} — {q.client_name || "Sans client"} ({formatFcfa(q.total)})
                    </option>
                  ))}
                </select>
                {quote && (
                  <div className="mt-2.5 flex flex-col gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={importQuoteLines} className="rounded-full px-4 text-xs">
                      Reprendre les prestations
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={importQuoteTerms}
                      disabled={quote.payment_terms.length === 0}
                      className="rounded-full px-4 text-xs"
                    >
                      Facturer par acomptes ({quote.payment_terms.map((t) => `${t.percentage} %`).join(" + ") || "aucun"})
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-3">
                <span className={labelClass}>Client</span>
                <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} required />
              </label>
              <label className="block">
                <span className={labelClass}>Date</span>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} required />
              </label>
              <label className="block">
                <span className={labelClass}>Échéance</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>TVA (%)</span>
                <input type="number" inputMode="decimal" min={0} max={100} value={vatPercent} onChange={(e) => setVatPercent(e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>CSS (%)</span>
                <input type="number" inputMode="decimal" step="0.1" min={0} max={20} value={cssPercent} onChange={(e) => setCssPercent(e.target.value)} className={inputClass} />
              </label>
            </div>

            {extraChoices.length > 0 && (
              <div>
                <span className={labelClass}>Autres taxes</span>
                <div className="flex flex-wrap gap-2">
                  {extraChoices.map((tax) => {
                    const active = extraTaxes.some((t) => t.name === tax.name);
                    return (
                      <button
                        key={tax.name}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setExtraTaxes((prev) => (active ? prev.filter((t) => t.name !== tax.name) : [...prev, { name: tax.name, percent: tax.percent }]))
                        }
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                          active ? "border-primary bg-primary/10 text-primary" : "border-neutral-200 text-neutral-500 hover:border-neutral-300",
                        )}
                      >
                        <span className={cn("size-3 rounded-sm border", active ? "border-primary bg-primary" : "border-neutral-300")} />
                        {tax.name} {String(Number(tax.percent)).replace(".", ",")} %
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className={labelClass}>Lignes</span>
                <button type="button" onClick={() => setLines((l) => [...l, { ...EMPTY_LINE }])} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus className="size-3.5" /> Ajouter une ligne
                </button>
              </div>
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 p-2.5 sm:grid-cols-[minmax(0,1fr)_80px_130px_auto]">
                    <textarea
                      value={line.description}
                      onChange={(e) => updateLine(i, { description: e.target.value })}
                      placeholder="Description"
                      aria-label="Description"
                      rows={2}
                      className={cn(inputClass, "col-span-2 resize-y sm:col-span-1")}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      placeholder="Qté"
                      aria-label="Quantité"
                      className={inputClass}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      value={line.unit_price}
                      onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                      placeholder="Prix unitaire"
                      aria-label="Prix unitaire"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setLines((l) => l.filter((_, j) => j !== i))}
                      disabled={lines.length === 1}
                      aria-label="Retirer la ligne"
                      className="col-span-2 flex h-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-destructive/5 hover:text-destructive disabled:opacity-30 sm:col-span-1 sm:w-9"
                    >
                      <Trash2 className="size-4" />
                    </button>
                    <input
                      value={line.note ?? ""}
                      onChange={(e) => updateLine(i, { note: e.target.value })}
                      placeholder="Note sous le prix (ex. soit 20 % du montant total)"
                      aria-label="Note sous le prix"
                      className={cn(inputClass, "col-span-2 text-xs sm:col-span-4")}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <label className="block">
                <span className={labelClass}>Réduction (FCFA)</span>
                <input type="number" inputMode="decimal" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Motif de la réduction</span>
                <input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Geste commercial, remise du devis…" className={inputClass} />
              </label>
            </div>

            <div className="rounded-lg bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-500">
              {totals.discount > 0 && (
                <div>
                  Sous-total {formatFcfa(totals.subtotal)} − réduction {formatFcfa(totals.discount)}
                </div>
              )}
              <div>
                Total à payer : <span className="font-semibold text-neutral-900">{formatFcfa(totals.ttc)}</span>
                {(vatRate > 0 || cssRate > 0 || totals.extras.length > 0) && (
                  <span className="text-xs">
                    {" "}(dont {[
                      vatRate > 0 && `TVA ${formatFcfa(totals.vat)}`,
                      cssRate > 0 && `CSS ${formatFcfa(totals.css)}`,
                      ...totals.extras.map((t) => `${t.name} ${formatFcfa(t.amount)}`),
                    ].filter(Boolean).join(", ")})
                  </span>
                )}
              </div>
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={() => router.push(BASE_PATH)} className="rounded-full px-4">
              Annuler
            </Button>
            {!locked && (
              <Button type="submit" disabled={saving} className="rounded-full px-6">
                {saving ? <Loader2 className="size-4 animate-spin" /> : current ? "Enregistrer" : "Créer la facture"}
              </Button>
            )}
          </div>
        </form>

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <p className={labelClass}>Aperçu</p>
          {context ? (
            <>
              <DocumentPreviewCards
                pageCount={1}
                renderPage={() => <InvoiceDocument invoice={preview} settings={context.settings} accentColor={documentColor} />}
              />
              <div className="mt-3">
                <span className={labelClass}>Couleur du document</span>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      disabled={locked}
                      onClick={() => setDocumentColor(swatch)}
                      aria-label={swatch}
                      className="flex size-8 items-center justify-center rounded-lg ring-offset-2 transition-shadow disabled:opacity-50"
                      style={{
                        backgroundColor: swatch,
                        boxShadow: documentColor === swatch ? "0 0 0 2px white, 0 0 0 4px #171717" : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-40 w-full max-w-72 items-center justify-center rounded-xl bg-neutral-100">
              <Loader2 className="size-5 animate-spin text-neutral-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Encadré du paiement : payé / reste, et « Marquer comme payée » qui
 * enregistre le reste comme versement reçu. Les acomptes partiels se
 * saisissent dans la liste (Versements). */
function PaymentStatus({
  totals,
  canPay,
  payMethod,
  onPayMethod,
  paying,
  onMarkPaid,
}: {
  totals: ReturnType<typeof invoiceTotals>;
  canPay: boolean;
  payMethod: string;
  onPayMethod: (method: string) => void;
  paying: boolean;
  onMarkPaid: () => void;
}) {
  const settled = totals.due <= 0 && totals.ttc > 0;
  return (
    <div className={cn("rounded-xl border p-3.5", settled ? "border-emerald-200 bg-emerald-50" : "border-neutral-200")}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-neutral-600">
          Déjà payé : <span className="font-semibold text-neutral-900">{formatFcfa(totals.paid)}</span>
        </span>
        {settled ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="size-4" /> Payée
          </span>
        ) : (
          <span className="text-neutral-600">
            Reste à payer : <span className="font-semibold text-neutral-900">{formatFcfa(totals.due)}</span>
          </span>
        )}
      </div>
      {canPay && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select value={payMethod} onChange={(e) => onPayMethod(e.target.value)} className={cn(inputClass, "sm:w-52")} aria-label="Moyen de paiement">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <Button type="button" onClick={onMarkPaid} disabled={paying} className="gap-1.5 rounded-full px-4">
            {paying ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Marquer comme payée
          </Button>
        </div>
      )}
    </div>
  );
}
