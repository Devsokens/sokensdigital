"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Send, Copy, CopyPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  listQuotes,
  createQuote,
  deleteQuote,
  sendQuote,
  cloneQuote,
  type QuoteInput,
  type QuoteLineInput,
} from "@/lib/api/marketing";
import type { Quote, QuoteStatus } from "@/lib/api/types";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
};

const STATUS_COLORS: Record<QuoteStatus, string> = {
  BROUILLON: "bg-neutral-100 text-neutral-500",
  ENVOYE: "bg-amber-100 text-amber-700",
  ACCEPTE: "bg-emerald-100 text-emerald-700",
  REFUSE: "bg-destructive/10 text-destructive",
};

function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
}

export function QuoteList() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await listQuotes();
      setQuotes(data.results);
    } catch {
      setError("Impossible de charger les devis.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSend(quote: Quote) {
    setBusyId(quote.id);
    try {
      await sendQuote(quote.id);
      load();
    } catch {
      setError(`Impossible d'envoyer "${quote.quote_number}" — vérifie qu'il a au moins une ligne.`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleClone(quote: Quote) {
    setBusyId(quote.id);
    try {
      await cloneQuote(quote.id);
      load();
    } catch {
      setError(`Impossible de dupliquer "${quote.quote_number}".`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(quote: Quote) {
    if (!confirm(`Supprimer "${quote.quote_number}" ?`)) return;
    try {
      await deleteQuote(quote.id);
      load();
    } catch {
      setError(`Impossible de supprimer "${quote.quote_number}".`);
    }
  }

  function copyTrackingLink(quote: Quote) {
    const url = `${apiBaseUrl()}/api/v1/public/quotes/track/${quote.tracking_token}/`;
    navigator.clipboard.writeText(url);
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!quotes) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Devis</h1>
          <p className="text-sm text-neutral-500">
            Un devis envoyé devient en lecture seule — utilise &quot;Dupliquer&quot; pour créer une nouvelle version.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Nouveau devis
              </Button>
            }
          />
          <SheetContent title="Nouveau devis">
            <QuoteForm onSaved={() => { setOpen(false); load(); }} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Total TTC</th>
              <th className="px-4 py-3 font-medium">Ouvert le</th>
              <th className="w-32 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td className="px-4 py-3 text-neutral-900">
                  {quote.quote_number}
                  {quote.version > 1 && <span className="ml-1 text-xs text-neutral-400">v{quote.version}</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[quote.status]}`}>
                    {STATUS_LABELS[quote.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-900">{quote.total_ttc} €</td>
                <td className="px-4 py-3 text-neutral-500">
                  {quote.opened_at ? new Date(quote.opened_at).toLocaleDateString("fr-FR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {quote.status === "BROUILLON" && (
                      <button
                        type="button"
                        onClick={() => handleSend(quote)}
                        disabled={busyId === quote.id}
                        aria-label="Envoyer"
                        className="text-neutral-400 hover:text-primary"
                      >
                        <Send className="size-4" />
                      </button>
                    )}
                    {quote.status !== "BROUILLON" && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyTrackingLink(quote)}
                          aria-label="Copier le lien de suivi"
                          className="text-neutral-400 hover:text-primary"
                        >
                          <Copy className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClone(quote)}
                          disabled={busyId === quote.id}
                          aria-label="Dupliquer"
                          className="text-neutral-400 hover:text-primary"
                        >
                          <CopyPlus className="size-4" />
                        </button>
                      </>
                    )}
                    {quote.status === "BROUILLON" && (
                      <button
                        type="button"
                        onClick={() => handleDelete(quote)}
                        aria-label="Supprimer"
                        className="text-neutral-400 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  Aucun devis pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const EMPTY_LINE: QuoteLineInput = { service_title: "", quantity: "1", unit_price: "0" };

function QuoteForm({ onSaved }: { onSaved: () => void }) {
  const [lines, setLines] = useState<QuoteLineInput[]>([{ ...EMPTY_LINE }]);
  const [expiryDate, setExpiryDate] = useState("");
  const [discount, setDiscount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateLine(index: number, patch: Partial<QuoteLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const estimatedHt = lines.reduce(
    (sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
    0
  ) - (Number(discount) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: QuoteInput = {
      expiry_date: expiryDate || undefined,
      discount_amount: discount,
      lines: lines.filter((l) => l.service_title.trim()),
    };

    if (payload.lines.length === 0) {
      setError("Ajoute au moins une ligne de prestation.");
      return;
    }

    setSaving(true);
    try {
      await createQuote(payload);
      onSaved();
    } catch {
      setError("Impossible de créer le devis.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <label className="block">
        <span className={labelClass}>Date d&apos;expiration</span>
        <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>Lignes de prestation</span>
          <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="size-3.5" /> Ajouter une ligne
          </button>
        </div>
        <div className="space-y-3">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg border border-neutral-200 p-3">
              <label className="col-span-6 block">
                <span className={labelClass}>Prestation</span>
                <input
                  value={line.service_title}
                  onChange={(e) => updateLine(i, { service_title: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="col-span-2 block">
                <span className={labelClass}>Qté</span>
                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="col-span-3 block">
                <span className={labelClass}>Prix unitaire</span>
                <input
                  type="number"
                  value={line.unit_price}
                  onChange={(e) => updateLine(i, { unit_price: e.target.value })}
                  className={inputClass}
                />
              </label>
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length === 1}
                aria-label="Retirer la ligne"
                className="col-span-1 flex justify-center text-neutral-400 hover:text-destructive disabled:opacity-30"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>Remise (montant)</span>
        <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
      </label>

      <div className="rounded-lg bg-neutral-50 px-3.5 py-2.5 text-sm text-neutral-500">
        Total HT estimé : <span className="font-medium text-neutral-900">{estimatedHt.toFixed(2)} €</span>
        <span className="ml-1 text-xs">(TVA calculée côté serveur à l&apos;enregistrement)</span>
      </div>

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Créer le devis"}
        </Button>
      </div>
    </form>
  );
}
