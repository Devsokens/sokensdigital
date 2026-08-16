"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { formatFcfa } from "@/lib/format-currency";
import {
  createQuote,
  updateQuote,
  getQuoteSettings,
  type QuoteInput,
  type QuoteLineInput,
} from "@/lib/api/marketing";
import type { Quote, QuoteSettings, QuotePaymentTerm } from "@/lib/api/types";
import { QuoteDocumentPages, QUOTE_PAGE_COUNT, type QuoteDocumentData } from "@/components/admin/marketing/quote-document-pages";
import { DocumentPreviewCards } from "@/components/admin/marketing/document-preview-cards";
import { DOCUMENT_COLOR_SWATCHES } from "@/components/admin/marketing/document-print-primitives";
import { cn } from "@/lib/utils";

const EMPTY_LINE: QuoteLineInput = { service_title: "", description: "", quantity: "1", unit_price: "0", amount_label: "" };
const EMPTY_TERM: QuotePaymentTerm = { label: "", percentage: 0 };

const STEPS = ["Informations", "Prestations", "Conditions"];

function linesFromQuote(quote?: Quote): QuoteLineInput[] {
  if (!quote || quote.lines.length === 0) return [{ ...EMPTY_LINE }];
  return quote.lines.map((l) => ({
    service_title: l.service_title,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unit_price,
    amount_label: l.amount_label,
  }));
}

export function QuoteEditor({ quote, basePath = "/admin/marketing/devis" }: { quote?: Quote; basePath?: string }) {
  const router = useRouter();
  const [clientName, setClientName] = useState(quote?.client_name ?? "");
  const [subject, setSubject] = useState(quote?.subject ?? "");
  const [introMessage, setIntroMessage] = useState(quote?.intro_message ?? "");
  const [description, setDescription] = useState(quote?.description ?? "");
  const [projectDuration, setProjectDuration] = useState(quote?.project_duration ?? "");
  const [expiryDate, setExpiryDate] = useState(quote?.expiry_date ?? "");
  const [discount, setDiscount] = useState(quote?.discount_amount ?? "0");
  const [documentColor, setDocumentColor] = useState(quote?.document_color ?? DOCUMENT_COLOR_SWATCHES[0]);
  const [lines, setLines] = useState<QuoteLineInput[]>(linesFromQuote(quote));
  const [terms, setTerms] = useState<QuotePaymentTerm[]>(quote?.payment_terms ?? []);
  const [settings, setSettings] = useState<QuoteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    getQuoteSettings()
      .then((s) => {
        setSettings(s);
        if (!quote) setTerms((prev) => (prev.length > 0 ? prev : s.default_payment_terms));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateLine(index: number, patch: Partial<QuoteLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTerm(index: number, patch: Partial<QuotePaymentTerm>) {
    setTerms((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTerm() {
    setTerms((prev) => [...prev, { ...EMPTY_TERM }]);
  }

  function removeTerm(index: number) {
    setTerms((prev) => prev.filter((_, i) => i !== index));
  }

  const estimatedHt = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
    0
  ) - (Number(discount) || 0);
  const estimatedTtc = estimatedHt * 1.18;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: QuoteInput = {
      client_name: clientName,
      subject,
      intro_message: introMessage,
      description,
      project_duration: projectDuration,
      payment_terms: terms.filter((t) => t.label.trim()),
      expiry_date: expiryDate || undefined,
      discount_amount: discount,
      document_color: documentColor,
      lines: lines.filter((l) => l.service_title.trim()),
    };

    if (payload.lines.length === 0) {
      setError("Ajoute au moins une ligne de prestation.");
      return;
    }

    setSaving(true);
    try {
      const saved = quote ? await updateQuote(quote.id, payload) : await createQuote(payload);
      router.push(`${basePath}?saved=${saved.id}`);
    } catch {
      setError(quote ? "Impossible de modifier ce devis." : "Impossible de créer le devis.");
    } finally {
      setSaving(false);
    }
  }

  const draftDocument: QuoteDocumentData = {
    quote_number: quote?.quote_number ?? "BROUILLON",
    client_name: clientName,
    intro_message: introMessage,
    subject,
    description,
    project_duration: projectDuration,
    issue_date: quote?.issue_date ?? "",
    discount_amount: discount,
    payment_terms: terms.length > 0 ? terms : settings?.default_payment_terms ?? [],
    lines: lines.map((l, i) => ({
      id: String(i),
      service_title: l.service_title,
      description: l.description ?? "",
      total_line: String((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)),
      amount_label: l.amount_label ?? "",
    })),
  };

  return (
    <div>
      <Link
        href={basePath}
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="size-3.5" /> Devis
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
        {quote ? `Modifier ${quote.quote_number}` : "Nouveau devis"}
      </h1>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    step === i ? "bg-primary text-primary-foreground" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  )}
                >
                  <span className="flex size-4 items-center justify-center rounded-full bg-white/25 text-[0.65rem]">{i + 1}</span>
                  {label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="size-3.5 text-neutral-300" />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Client</span>
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Date d&apos;expiration</span>
                  <input type="date" value={expiryDate ?? ""} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Objet</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Création de l'application web pour ..."
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Durée du projet</span>
                <input
                  value={projectDuration}
                  onChange={(e) => setProjectDuration(e.target.value)}
                  placeholder="2 mois"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Message d&apos;introduction (page de garde)</span>
                <textarea value={introMessage} onChange={(e) => setIntroMessage(e.target.value)} rows={4} className={inputClass} />
              </label>

              <label className="block">
                <span className={labelClass}>Description du projet</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className={labelClass}>Lignes de prestation</span>
                  <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="size-3.5" /> Ajouter une ligne
                  </button>
                </div>
                <div className="space-y-3">
                  {lines.map((line, i) => {
                    const lineTotal = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
                    return (
                      <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-2.5">
                        <input
                          value={line.service_title}
                          onChange={(e) => updateLine(i, { service_title: e.target.value })}
                          placeholder="Prestation"
                          className={cn(inputClass, "min-w-[160px] flex-[2]")}
                        />
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(i, { description: e.target.value })}
                          placeholder="Description"
                          className={cn(inputClass, "min-w-[160px] flex-[2]")}
                        />
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(i, { quantity: e.target.value })}
                          placeholder="Qté"
                          className={cn(inputClass, "w-20 shrink-0")}
                        />
                        <input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                          placeholder="Prix unitaire"
                          className={cn(inputClass, "w-32 shrink-0")}
                        />
                        <input
                          value={line.amount_label}
                          onChange={(e) => updateLine(i, { amount_label: e.target.value })}
                          placeholder="Montant affiché (ex. Offert)"
                          className={cn(inputClass, "min-w-[160px] flex-1")}
                        />
                        <span className="w-28 shrink-0 text-right text-xs text-neutral-500">{formatFcfa(lineTotal)}</span>
                        <button
                          type="button"
                          onClick={() => removeLine(i)}
                          disabled={lines.length === 1}
                          aria-label="Retirer la ligne"
                          className="shrink-0 text-neutral-400 hover:text-destructive disabled:opacity-30"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="block">
                <span className={labelClass}>Remise (montant)</span>
                <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
              </label>

              <div className="rounded-lg bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-500">
                <div>Total HT estimé : <span className="font-medium text-neutral-900">{formatFcfa(estimatedHt)}</span></div>
                <div>Total TTC (TVA 18%) : <span className="font-medium text-neutral-900">{formatFcfa(estimatedTtc)}</span></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className={labelClass}>Conditions de paiement</span>
                  <button type="button" onClick={addTerm} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="size-3.5" /> Ajouter une échéance
                  </button>
                </div>
                <div className="space-y-2">
                  {terms.map((term, i) => (
                    <div key={i} className="grid grid-cols-12 items-end gap-2">
                      <label className="col-span-8 block">
                        <span className={labelClass}>Libellé</span>
                        <input value={term.label} onChange={(e) => updateTerm(i, { label: e.target.value })} className={inputClass} />
                      </label>
                      <label className="col-span-3 block">
                        <span className={labelClass}>%</span>
                        <input
                          type="number"
                          value={term.percentage}
                          onChange={(e) => updateTerm(i, { percentage: Number(e.target.value) })}
                          className={inputClass}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removeTerm(i)}
                        aria-label="Retirer l'échéance"
                        className="col-span-1 flex justify-center text-neutral-400 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-500">
                <div>Total HT estimé : <span className="font-medium text-neutral-900">{formatFcfa(estimatedHt)}</span></div>
                <div>Total TTC (TVA 18%) : <span className="font-medium text-neutral-900">{formatFcfa(estimatedTtc)}</span></div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => router.push(basePath)} className="rounded-full px-4">
              Annuler
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} className="rounded-full px-4">
                  Précédent
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-full px-5">
                  Suivant
                </Button>
              ) : (
                <Button type="submit" disabled={saving} className="rounded-full px-5">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : quote ? "Enregistrer" : "Créer le devis"}
                </Button>
              )}
            </div>
          </div>
        </form>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <p className={labelClass}>Aperçu</p>
          {settings ? (
            <>
              <DocumentPreviewCards
                pageCount={QUOTE_PAGE_COUNT}
                renderPage={(page) => (
                  <QuoteDocumentPages quote={draftDocument} settings={settings} accentColor={documentColor} onlyPage={page} />
                )}
              />
              <div className="mt-3">
                <span className={labelClass}>Couleur du document</span>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setDocumentColor(swatch)}
                      aria-label={swatch}
                      className="flex size-8 items-center justify-center rounded-lg ring-offset-2 transition-shadow"
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
            <div className="flex h-40 w-72 items-center justify-center rounded-xl bg-neutral-100">
              <Loader2 className="size-5 animate-spin text-neutral-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
