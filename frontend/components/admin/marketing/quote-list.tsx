"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Send, Copy, CopyPlus, Pencil, Printer, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  listQuotes,
  createQuote,
  updateQuote,
  deleteQuote,
  sendQuote,
  cloneQuote,
  getQuoteSettings,
  updateQuoteSettings,
  type QuoteInput,
  type QuoteLineInput,
} from "@/lib/api/marketing";
import type { Quote, QuoteStatus, QuotePaymentTerm, QuoteSettings } from "@/lib/api/types";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            aria-label="Paramètres des devis"
            className="size-9 rounded-full p-0"
          >
            <Settings className="size-4" />
          </Button>
          <Sheet
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setEditing(null);
            }}
          >
            <SheetTrigger
              render={
                <Button
                  data-tour="module-marketing-devis"
                  className="gap-1.5 rounded-full px-4"
                  onClick={() => setEditing(null)}
                >
                  <Plus className="size-4" /> Nouveau devis
                </Button>
              }
            />
            <SheetContent title={editing ? `Modifier ${editing.quote_number}` : "Nouveau devis"}>
              <QuoteForm
                quote={editing ?? undefined}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                  load();
                }}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent title="Paramètres des devis">
          <QuoteSettingsForm onSaved={() => setSettingsOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">N°</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Total TTC</th>
              <th className="px-4 py-3 font-medium">Ouvert le</th>
              <th className="w-40 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td className="px-4 py-3 text-neutral-900">
                  {quote.quote_number}
                  {quote.version > 1 && <span className="ml-1 text-xs text-neutral-400">v{quote.version}</span>}
                </td>
                <td className="px-4 py-3 text-neutral-600">{quote.client_name || "—"}</td>
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
                    <a
                      href={`/admin/marketing/devis/${quote.id}/imprimer`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Aperçu / PDF"
                      className="text-neutral-400 hover:text-primary"
                    >
                      <Printer className="size-4" />
                    </a>
                    {quote.status === "BROUILLON" && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(quote);
                            setOpen(true);
                          }}
                          aria-label="Modifier"
                          className="text-neutral-400 hover:text-primary"
                        >
                          <Pencil className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSend(quote)}
                          disabled={busyId === quote.id}
                          aria-label="Envoyer"
                          className="text-neutral-400 hover:text-primary"
                        >
                          <Send className="size-4" />
                        </button>
                      </>
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
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
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

const EMPTY_LINE: QuoteLineInput = { service_title: "", description: "", quantity: "1", unit_price: "0", amount_label: "" };
const EMPTY_TERM: QuotePaymentTerm = { label: "", percentage: 0 };

function lineFromQuote(quote?: Quote): QuoteLineInput[] {
  if (!quote || quote.lines.length === 0) return [{ ...EMPTY_LINE }];
  return quote.lines.map((l) => ({
    service_title: l.service_title,
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unit_price,
    amount_label: l.amount_label,
  }));
}

function QuoteForm({ onSaved, quote }: { onSaved: () => void; quote?: Quote }) {
  const [clientName, setClientName] = useState(quote?.client_name ?? "");
  const [subject, setSubject] = useState(quote?.subject ?? "");
  const [introMessage, setIntroMessage] = useState(quote?.intro_message ?? "");
  const [description, setDescription] = useState(quote?.description ?? "");
  const [projectDuration, setProjectDuration] = useState(quote?.project_duration ?? "");
  const [expiryDate, setExpiryDate] = useState(quote?.expiry_date ?? "");
  const [discount, setDiscount] = useState(quote?.discount_amount ?? "0");
  const [lines, setLines] = useState<QuoteLineInput[]>(lineFromQuote(quote));
  const [terms, setTerms] = useState<QuotePaymentTerm[]>(quote?.payment_terms ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quote) return; // editing an existing quote — keep its own terms
    getQuoteSettings()
      .then((s) => setTerms(s.default_payment_terms))
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
      lines: lines.filter((l) => l.service_title.trim()),
    };

    if (payload.lines.length === 0) {
      setError("Ajoute au moins une ligne de prestation.");
      return;
    }

    setSaving(true);
    try {
      if (quote) {
        await updateQuote(quote.id, payload);
      } else {
        await createQuote(payload);
      }
      onSaved();
    } catch {
      setError(quote ? "Impossible de modifier ce devis." : "Impossible de créer le devis.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Client</span>
          <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Date d&apos;expiration</span>
          <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className={inputClass} />
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
        <textarea
          value={introMessage}
          onChange={(e) => setIntroMessage(e.target.value)}
          rows={5}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Description du projet</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
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
            <div key={i} className="space-y-2 rounded-lg border border-neutral-200 p-3">
              <div className="grid grid-cols-12 items-end gap-2">
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
              <label className="block">
                <span className={labelClass}>Description (colonne du devis)</span>
                <textarea
                  value={line.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                  rows={2}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Montant affiché (optionnel — remplace le prix calculé, ex. &quot;Offert&quot;)</span>
                <input
                  value={line.amount_label}
                  onChange={(e) => updateLine(i, { amount_label: e.target.value })}
                  className={inputClass}
                />
              </label>
            </div>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>Remise (montant)</span>
        <input type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} />
      </label>

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
                <input
                  value={term.label}
                  onChange={(e) => updateTerm(i, { label: e.target.value })}
                  className={inputClass}
                />
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
        Total HT estimé : <span className="font-medium text-neutral-900">{estimatedHt.toFixed(2)} €</span>
        <span className="ml-1 text-xs">(TVA calculée côté serveur à l&apos;enregistrement)</span>
      </div>

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : quote ? "Enregistrer" : "Créer le devis"}
        </Button>
      </div>
    </form>
  );
}

function QuoteSettingsForm({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<QuoteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getQuoteSettings()
      .then(setSettings)
      .catch(() => setError("Impossible de charger les paramètres."));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!settings) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  function updateMethod(index: number, label: string) {
    setSettings((prev) => (prev ? { ...prev, payment_methods: prev.payment_methods.map((m, i) => (i === index ? { label } : m)) } : prev));
  }

  function addMethod() {
    setSettings((prev) => (prev ? { ...prev, payment_methods: [...prev.payment_methods, { label: "" }] } : prev));
  }

  function removeMethod(index: number) {
    setSettings((prev) => (prev ? { ...prev, payment_methods: prev.payment_methods.filter((_, i) => i !== index) } : prev));
  }

  function updateDefaultTerm(index: number, patch: Partial<QuotePaymentTerm>) {
    setSettings((prev) =>
      prev ? { ...prev, default_payment_terms: prev.default_payment_terms.map((t, i) => (i === index ? { ...t, ...patch } : t)) } : prev
    );
  }

  function addDefaultTerm() {
    setSettings((prev) => (prev ? { ...prev, default_payment_terms: [...prev.default_payment_terms, { ...EMPTY_TERM }] } : prev));
  }

  function removeDefaultTerm(index: number) {
    setSettings((prev) => (prev ? { ...prev, default_payment_terms: prev.default_payment_terms.filter((_, i) => i !== index) } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaving(true);
    try {
      await updateQuoteSettings(settings);
      onSaved();
    } catch {
      setError("Impossible d'enregistrer les paramètres.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <p className="text-xs text-neutral-500">
        Ces textes apparaissent sur le PDF de chaque devis (adresse, moyens de paiement, échéances par défaut, mention légale).
      </p>

      <label className="block">
        <span className={labelClass}>Adresse</span>
        <textarea
          value={settings.company_address}
          onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
          rows={2}
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Téléphone</span>
          <input
            value={settings.company_phone}
            onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Email</span>
          <input
            value={settings.company_email}
            onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>Moyens de paiement</span>
          <button type="button" onClick={addMethod} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="size-3.5" /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {settings.payment_methods.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={m.label} onChange={(e) => updateMethod(i, e.target.value)} className={inputClass} />
              <button type="button" onClick={() => removeMethod(i)} className="text-neutral-400 hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className={labelClass}>Échéances de paiement par défaut</span>
          <button type="button" onClick={addDefaultTerm} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus className="size-3.5" /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {settings.default_payment_terms.map((term, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2">
              <input
                value={term.label}
                onChange={(e) => updateDefaultTerm(i, { label: e.target.value })}
                className={`${inputClass} col-span-8`}
              />
              <input
                type="number"
                value={term.percentage}
                onChange={(e) => updateDefaultTerm(i, { percentage: Number(e.target.value) })}
                className={`${inputClass} col-span-3`}
              />
              <button
                type="button"
                onClick={() => removeDefaultTerm(i)}
                className="col-span-1 flex justify-center text-neutral-400 hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>Mention légale (bas de page)</span>
        <textarea
          value={settings.footer_note}
          onChange={(e) => setSettings({ ...settings, footer_note: e.target.value })}
          rows={3}
          className={inputClass}
        />
      </label>

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
