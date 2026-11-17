"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Mail, PanelTop, Plus, RotateCcw, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { DOCUMENT_COLOR_SWATCHES } from "@/components/admin/marketing/document-print-primitives";
import { SendDocumentModal } from "@/components/admin/marketing/send-document-modal";
import { ContractPreview } from "@/components/admin/contracts/contract-pages";
import { ContractSettingsForm } from "@/components/admin/contracts/contract-settings-form";
import {
  DEFAULT_FINANCIAL_TERMS,
  DEFAULT_PARTNER_COMMITMENTS,
  DEFAULT_PARTNERSHIP_PREAMBLE,
  DEFAULT_PROVIDER_COMMITMENTS,
  documentTitle,
} from "@/components/admin/contracts/contract-blocks";
import { ApiError } from "@/lib/api/client";
import {
  createServiceContract,
  downloadServiceContractPdf,
  getContractEditorContext,
  sendServiceContract,
  updateServiceContract,
  type ContractEditorContext,
  type ContractKind,
  type ServiceContract,
  type ServiceContractFields,
} from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

export const CONTRACTS_PATH = "/admin/rh/contrats-travail";
const CONTRACT_SWATCHES = ["#1f3864", ...DOCUMENT_COLOR_SWATCHES];

const DEFAULT_PREAMBLE =
  "Le Client souhaite confier au Prestataire la réalisation de prestations de conception de solutions digitales pour accélérer sa transformation numérique. Le Prestataire déclare disposer des compétences, des moyens et des autorisations nécessaires pour les exécuter.";

export const EMPTY_CONTRACT: ServiceContractFields = {
  contract_type: "PRESTATION",
  partnership_purpose: "",
  provider_commitments: DEFAULT_PROVIDER_COMMITMENTS,
  partner_commitments: DEFAULT_PARTNER_COMMITMENTS,
  financial_terms: DEFAULT_FINANCIAL_TERMS,
  exclusivity: false,
  client: null,
  quote: null,
  client_name: "",
  client_legal_form: "",
  client_address: "",
  client_rccm: "",
  client_nif: "",
  client_representative: "",
  client_email: "",
  preamble: DEFAULT_PREAMBLE,
  services_description: "",
  start_date: null,
  duration: "",
  renewal: "TERME",
  renewal_notice_days: 30,
  amount: "0",
  amount_basis: "HT",
  payment_schedule: [
    { label: "À la signature du contrat et réception de la facture", percentage: 20 },
    { label: "Au lancement des travaux", percentage: 30 },
    { label: "À la livraison des livrables", percentage: 50 },
  ],
  first_payment_days: 30,
  payment_methods: "par chèque, par mobile money ou en espèces",
  late_penalty_rate: "2",
  expenses_covered: false,
  expenses_threshold: null,
  confidentiality_years: 5,
  liability_cap: "au montant total du prix du contrat",
  insurance: "",
  annex_specifications: "",
  annex_pricing: "",
  signing_date: null,
  client_signatory: "",
  provider_signatory: "",
  document_color: "#1f3864",
  show_header: true,
};

function fieldsOf(contract: ServiceContract): ServiceContractFields {
  const fields = { ...EMPTY_CONTRACT };
  for (const key of Object.keys(EMPTY_CONTRACT) as (keyof ServiceContractFields)[]) {
    (fields as Record<string, unknown>)[key] = contract[key] ?? EMPTY_CONTRACT[key];
  }
  return fields;
}

function errorDetail(err: unknown) {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== "object") return null;
  const body = err.body as Record<string, unknown>;
  if (typeof body.detail === "string") return body.detail;
  const first = Object.values(body)[0];
  if (Array.isArray(first) && typeof first[0] === "string") return first[0];
  return typeof first === "string" ? first : null;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
      <h2 className="mb-3.5 text-sm font-semibold text-neutral-900">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

/** Contrat de prestation de services : formulaire à gauche, aperçu paginé à
 * droite (même document que le PDF). Peut reprendre un devis (client,
 * prestations, montant, échéancier) ou un client du CRM. */
export function ContractEditor({ contract, initialType = "PRESTATION" }: { contract?: ServiceContract; initialType?: ContractKind }) {
  const router = useRouter();
  const [current, setCurrent] = useState<ServiceContract | undefined>(contract);
  const [form, setForm] = useState<ServiceContractFields>(
    contract
      ? fieldsOf(contract)
      : initialType === "PARTENARIAT"
        ? { ...EMPTY_CONTRACT, contract_type: "PARTENARIAT", preamble: DEFAULT_PARTNERSHIP_PREAMBLE }
        : EMPTY_CONTRACT,
  );
  const partnership = form.contract_type === "PARTENARIAT";
  const title = documentTitle(form.contract_type);
  const [context, setContext] = useState<ContractEditorContext | null>(null);
  const [pickedQuote, setPickedQuote] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const locked = !!current && current.status !== "BROUILLON";

  useEffect(() => {
    getContractEditorContext()
      .then((ctx) => {
        setContext(ctx);
        if (!contract) setForm((f) => ({ ...f, provider_signatory: f.provider_signatory || ctx.settings.provider_signatory }));
      })
      .catch(() => setError("Impossible de charger les paramètres, les devis et les clients."));
  }, [contract]);

  const set = (patch: Partial<ServiceContractFields>) => setForm((f) => ({ ...f, ...patch }));
  const scheduleTotal = form.payment_schedule.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);
  const quote = context?.quotes.find((q) => q.id === pickedQuote);
  const linkedQuote = context?.quotes.find((q) => q.id === form.quote)?.quote_number ?? current?.quote_number ?? null;
  // L'aperçu ne suit pas chaque frappe à la lettre : il se met à jour une fois la saisie posée.
  const [preview, setPreview] = useState(form);
  useEffect(() => {
    const t = setTimeout(() => setPreview(form), 250);
    return () => clearTimeout(t);
  }, [form]);
  const previewSettings = useMemo(() => context?.settings ?? null, [context]);

  function importQuote() {
    if (!quote || !context) return;
    const hasContent = form.services_description.trim() || form.annex_specifications.trim();
    if (hasContent && !window.confirm("Remplacer les prestations et l'annexe par celles du devis ?")) return;
    const total = Number(quote.total_ht) || 0;
    const ttc = context.quote_amount_basis === "TTC";
    const titles = quote.lines.map((l) => l.service_title.trim()).filter(Boolean);
    const annex = [
      quote.description.trim(),
      ...quote.lines.map((l) => [`**${l.service_title.trim()}**`, l.description.trim()].filter(Boolean).join("\n")),
    ].filter(Boolean);
    set({
      quote: quote.id,
      client: quote.client_id ?? form.client,
      client_name: quote.client_name || form.client_name,
      client_email: quote.client_email || form.client_email,
      services_description: titles.length ? titles.map((t) => `- ${t}`).join("\n") : quote.subject,
      annex_specifications: annex.join("\n\n"),
      amount: String(Math.round(ttc ? total * 1.18 : total)),
      amount_basis: ttc ? "TTC" : "HT",
      payment_schedule: quote.payment_terms.length ? quote.payment_terms : form.payment_schedule,
      duration: quote.project_duration || form.duration,
    });
  }

  function importClient(id: string) {
    const client = context?.clients.find((c) => c.id === id);
    if (!client) return;
    set({
      client: client.id,
      client_name: client.company_name,
      client_address: client.address || form.client_address,
      client_email: client.email || form.client_email,
    });
  }

  function updateTerm(index: number, patch: Partial<{ label: string; percentage: number }>) {
    set({ payment_schedule: form.payment_schedule.map((t, i) => (i === index ? { ...t, ...patch } : t)) });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const data: ServiceContractFields = {
      ...form,
      amount: String(Math.round(Number(form.amount) || 0)),
      expenses_threshold: form.expenses_covered && Number(form.expenses_threshold) ? String(Math.round(Number(form.expenses_threshold))) : null,
      payment_schedule: form.payment_schedule.filter((t) => t.label.trim() || Number(t.percentage)),
    };
    try {
      if (current) {
        const saved = await updateServiceContract(current.id, data);
        setCurrent(saved);
        setNotice("Contrat enregistré.");
      } else {
        const saved = await createServiceContract(data);
        router.replace(`${CONTRACTS_PATH}/prestation/${saved.id}`);
      }
    } catch (err) {
      setError(errorDetail(err) ?? "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: ServiceContract["status"]) {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      setCurrent(await updateServiceContract(current.id, { status }));
    } catch (err) {
      setError(errorDetail(err) ?? "Changement de statut impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Link href={CONTRACTS_PATH} className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="size-3.5" /> Contrats
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {current ? `${title} ${current.contract_number}` : `Nouveau ${title.charAt(0).toLowerCase()}${title.slice(1)}`}
          </h1>
          {current && (
            <p className="text-sm text-neutral-500">
              {current.status === "BROUILLON" ? "Brouillon" : current.status === "ENVOYE" ? (partnership ? "Envoyé au partenaire" : "Envoyé au client") : "Signé"}
              {linkedQuote ? ` · devis ${linkedQuote}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            aria-label="Paramètres des contrats"
            title="Paramètres des contrats (prestataire, filigrane, cachet)"
            className="size-9 rounded-full p-0"
          >
            <Settings className="size-4" />
          </Button>
          {current && (
            <>
              {current.status !== "SIGNE" && (
                <Button type="button" variant="outline" onClick={() => setSendOpen(true)} className="gap-1.5 rounded-full px-4">
                  <Mail className="size-4" /> Envoyer par mail
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => downloadServiceContractPdf(current.id, current.contract_number).catch((err: Error) => setError(err.message))}
                className="gap-1.5 rounded-full px-4"
              >
                <Download className="size-4" /> PDF
              </Button>
              {current.status === "ENVOYE" && (
                <Button type="button" onClick={() => changeStatus("SIGNE")} disabled={busy} className="gap-1.5 rounded-full px-4">
                  <CheckCircle2 className="size-4" /> Marquer comme signé
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <form onSubmit={handleSave} className="min-w-0 space-y-4">
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">{error}</p>}
          {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800">{notice}</p>}
          {locked && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <span>{current?.status === "SIGNE" ? "Contrat signé" : "Contrat envoyé"} : son contenu est figé.</span>
              <button type="button" onClick={() => changeStatus("BROUILLON")} disabled={busy} className="inline-flex items-center gap-1 font-semibold hover:underline">
                <RotateCcw className="size-3.5" /> Repasser en brouillon pour modifier
              </button>
            </div>
          )}

          <fieldset disabled={locked} className="space-y-4">
            {context && ((!partnership && context.quotes.length > 0) || context.clients.length > 0) && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
                  <FileText className="size-4 text-primary" /> {partnership ? "Reprendre un client du CRM" : "Reprendre un devis ou un client"}
                </p>
                {!partnership && (
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Le devis apporte le client, les prestations (article 3 et annexe 1), le montant et l&apos;échéancier
                    {linkedQuote ? ` — lié : ${linkedQuote}` : ""}.
                  </p>
                )}
                {!partnership && (
                <div className="mt-2.5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <select value={pickedQuote} onChange={(e) => setPickedQuote(e.target.value)} className={inputClass} aria-label="Devis">
                    <option value="">Choisir un devis…</option>
                    {context.quotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.quote_number} — {q.client_name || "Sans client"}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" onClick={importQuote} disabled={!quote} className="rounded-full px-4 text-xs">
                    Reprendre le devis
                  </Button>
                </div>
                )}
                {context.clients.length > 0 && (
                  <select value="" onChange={(e) => importClient(e.target.value)} className={cn(inputClass, "mt-2")} aria-label="Client du CRM">
                    <option value="">{partnership ? "Choisir un client ou partenaire du CRM…" : "…ou reprendre un client du CRM"}</option>
                    {context.clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <Section title={partnership ? "Le Partenaire" : "Le Client"}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Dénomination sociale ou nom et prénom">
                  <input value={form.client_name} onChange={(e) => set({ client_name: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Forme juridique, capital social">
                  <input value={form.client_legal_form} onChange={(e) => set({ client_legal_form: e.target.value })} placeholder="SARL au capital de 1 000 000 FCFA" className={inputClass} />
                </Field>
                <Field label="Adresse du siège" className="sm:col-span-2">
                  <input value={form.client_address} onChange={(e) => set({ client_address: e.target.value })} placeholder="Quartier, Libreville, Gabon" className={inputClass} />
                </Field>
                <Field label="N° RCCM">
                  <input value={form.client_rccm} onChange={(e) => set({ client_rccm: e.target.value })} className={inputClass} />
                </Field>
                <Field label="NIF">
                  <input value={form.client_nif} onChange={(e) => set({ client_nif: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Représenté(e) par (nom, prénom et qualité)">
                  <input value={form.client_representative} onChange={(e) => set({ client_representative: e.target.value })} className={inputClass} />
                </Field>
                <Field label="E-mail (notifications et envoi)">
                  <input type="email" value={form.client_email} onChange={(e) => set({ client_email: e.target.value })} className={inputClass} />
                </Field>
              </div>
            </Section>

            {partnership && (
              <>
                <Section title="Objet du partenariat">
                  <Field label="Préambule">
                    <textarea value={form.preamble} onChange={(e) => set({ preamble: e.target.value })} rows={3} className={cn(inputClass, "resize-y")} />
                  </Field>
                  <Field label="Objet (article 1) — une ligne commençant par « - » par action commune">
                    <textarea
                      value={form.partnership_purpose}
                      onChange={(e) => set({ partnership_purpose: e.target.value })}
                      rows={4}
                      placeholder={"- Former les jeunes aux métiers du numérique\n- Co-organiser des événements"}
                      className={cn(inputClass, "resize-y")}
                    />
                  </Field>
                </Section>

                <Section title="Durée">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Prise d'effet">
                      <input type="date" value={form.start_date ?? ""} onChange={(e) => set({ start_date: e.target.value || null })} className={inputClass} />
                    </Field>
                    <Field label="Durée (vide = durée indéterminée)">
                      <input value={form.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="1 an" className={inputClass} />
                    </Field>
                    {form.duration.trim() && (
                      <Field label="À l'échéance">
                        <select value={form.renewal} onChange={(e) => set({ renewal: e.target.value as ServiceContractFields["renewal"] })} className={inputClass}>
                          <option value="TERME">Prend fin de plein droit</option>
                          <option value="RENOUVELABLE">Renouvelable par accord écrit</option>
                        </select>
                      </Field>
                    )}
                    {form.duration.trim() && form.renewal === "RENOUVELABLE" && (
                      <Field label="Accord au plus tard (jours avant)">
                        <input type="number" min={1} value={form.renewal_notice_days} onChange={(e) => set({ renewal_notice_days: Number(e.target.value) || 0 })} className={inputClass} />
                      </Field>
                    )}
                  </div>
                </Section>

                <Section title="Engagements des Parties">
                  <Field label="Soken's Digital s'engage à (article 4) — une ligne « - » par engagement">
                    <textarea value={form.provider_commitments} onChange={(e) => set({ provider_commitments: e.target.value })} rows={5} className={cn(inputClass, "resize-y")} />
                  </Field>
                  <Field label="Le Partenaire s'engage à (article 5)">
                    <textarea value={form.partner_commitments} onChange={(e) => set({ partner_commitments: e.target.value })} rows={5} className={cn(inputClass, "resize-y")} />
                  </Field>
                </Section>

                <Section title="Dispositions financières et clauses">
                  <Field label="Dispositions financières (article 7) — apports, partage de recettes, prise en charge des coûts">
                    <textarea value={form.financial_terms} onChange={(e) => set({ financial_terms: e.target.value })} rows={4} className={cn(inputClass, "resize-y")} />
                  </Field>
                  <label className="flex items-center gap-2.5 text-sm text-neutral-800">
                    <input type="checkbox" checked={form.exclusivity} onChange={(e) => set({ exclusivity: e.target.checked })} className="size-4 accent-primary" />
                    Partenariat exclusif (pas de partenariat identique avec un concurrent)
                  </label>
                  <Field label="Confidentialité après le terme (ans)" className="sm:w-60">
                    <input type="number" min={0} value={form.confidentiality_years} onChange={(e) => set({ confidentiality_years: Number(e.target.value) || 0 })} className={inputClass} />
                  </Field>
                </Section>

                <Section title="Annexe (facultative)">
                  <Field label="Plan d'actions — jalons, calendrier, référents">
                    <textarea value={form.annex_specifications} onChange={(e) => set({ annex_specifications: e.target.value })} rows={4} className={cn(inputClass, "resize-y")} />
                  </Field>
                </Section>
              </>
            )}

            {!partnership && (
            <>
            <Section title="Objet et prestations">
              <Field label="Préambule">
                <textarea value={form.preamble} onChange={(e) => set({ preamble: e.target.value })} rows={3} className={cn(inputClass, "resize-y")} />
              </Field>
              <Field label="Prestations (article 3) — une ligne commençant par « - » par prestation">
                <textarea
                  value={form.services_description}
                  onChange={(e) => set({ services_description: e.target.value })}
                  rows={4}
                  placeholder={"- Conception du site web\n- Formation de l'équipe"}
                  className={cn(inputClass, "resize-y")}
                />
              </Field>
            </Section>

            <Section title="Durée">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Prise d'effet">
                  <input type="date" value={form.start_date ?? ""} onChange={(e) => set({ start_date: e.target.value || null })} className={inputClass} />
                </Field>
                <Field label="Durée (vide = jusqu'à la fin des prestations)">
                  <input value={form.duration} onChange={(e) => set({ duration: e.target.value })} placeholder="6 mois" className={inputClass} />
                </Field>
                <Field label="À l'échéance">
                  <select value={form.renewal} onChange={(e) => set({ renewal: e.target.value as ServiceContractFields["renewal"] })} className={inputClass}>
                    <option value="TERME">Prend fin de plein droit</option>
                    <option value="RENOUVELABLE">Renouvelable par accord écrit</option>
                  </select>
                </Field>
                {form.renewal === "RENOUVELABLE" && (
                  <Field label="Accord au plus tard (jours avant)">
                    <input type="number" min={1} value={form.renewal_notice_days} onChange={(e) => set({ renewal_notice_days: Number(e.target.value) || 0 })} className={inputClass} />
                  </Field>
                )}
              </div>
            </Section>

            <Section title="Prix et paiement">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <Field label="Montant (FCFA)">
                  <input type="number" inputMode="numeric" min={0} value={form.amount === "0" ? "" : form.amount} onChange={(e) => set({ amount: e.target.value || "0" })} placeholder="0" className={inputClass} />
                </Field>
                <Field label="Montant exprimé">
                  <select value={form.amount_basis} onChange={(e) => set({ amount_basis: e.target.value as "HT" | "TTC" })} className={inputClass}>
                    <option value="HT">Hors taxes</option>
                    <option value="TTC">TTC</option>
                  </select>
                </Field>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={cn(labelClass, "mb-0")}>
                    Échéancier{" "}
                    <span className={scheduleTotal === 100 || form.payment_schedule.length === 0 ? "text-neutral-400" : "font-semibold text-destructive"}>
                      ({scheduleTotal} %)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => set({ payment_schedule: [...form.payment_schedule, { label: "", percentage: 0 }] })}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="size-3.5" /> Ajouter une échéance
                  </button>
                </div>
                <div className="space-y-2">
                  {form.payment_schedule.map((term, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,1fr)_80px_auto] gap-2">
                      <input value={term.label} onChange={(e) => updateTerm(i, { label: e.target.value })} placeholder="À la signature du contrat" aria-label="Échéance" className={inputClass} />
                      <input type="number" min={0} max={100} value={term.percentage || ""} onChange={(e) => updateTerm(i, { percentage: Number(e.target.value) })} placeholder="%" aria-label="Pourcentage" className={inputClass} />
                      <button
                        type="button"
                        onClick={() => set({ payment_schedule: form.payment_schedule.filter((_, j) => j !== i) })}
                        aria-label="Retirer l'échéance"
                        className="flex size-10 items-center justify-center rounded-lg text-neutral-400 hover:bg-destructive/5 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_120px]">
                <Field label="1er paiement (jours)">
                  <input type="number" min={1} value={form.first_payment_days} onChange={(e) => set({ first_payment_days: Number(e.target.value) || 0 })} className={inputClass} />
                </Field>
                <Field label="Moyens de paiement">
                  <input value={form.payment_methods} onChange={(e) => set({ payment_methods: e.target.value })} className={inputClass} />
                </Field>
                <Field label="Pénalité (% / mois)">
                  <input type="number" min={0} step="0.5" value={form.late_penalty_rate} onChange={(e) => set({ late_penalty_rate: e.target.value })} className={inputClass} />
                </Field>
              </div>
            </Section>

            <Section title="Clauses">
              <label className="flex items-center gap-2.5 text-sm text-neutral-800">
                <input type="checkbox" checked={form.expenses_covered} onChange={(e) => set({ expenses_covered: e.target.checked })} className="size-4 accent-primary" />
                Frais de déplacement et débours pris en charge par le Client
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {form.expenses_covered && (
                  <Field label="Accord écrit au-delà de (FCFA)">
                    <input type="number" min={0} value={form.expenses_threshold ?? ""} onChange={(e) => set({ expenses_threshold: e.target.value || null })} className={inputClass} />
                  </Field>
                )}
                <Field label="Confidentialité après le terme (ans)">
                  <input type="number" min={0} value={form.confidentiality_years} onChange={(e) => set({ confidentiality_years: Number(e.target.value) || 0 })} className={inputClass} />
                </Field>
                <Field label="Responsabilité limitée…" className="sm:col-span-2">
                  <input value={form.liability_cap} onChange={(e) => set({ liability_cap: e.target.value })} placeholder="au montant total du prix du contrat" className={inputClass} />
                </Field>
                <Field label="Assurance souscrite (facultatif)" className="sm:col-span-2">
                  <input
                    value={form.insurance}
                    onChange={(e) => set({ insurance: e.target.value })}
                    placeholder="une assurance de responsabilité civile professionnelle auprès de …, police n° …"
                    className={inputClass}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Annexes">
              <Field label="Annexe 1 — Cahier des charges">
                <textarea value={form.annex_specifications} onChange={(e) => set({ annex_specifications: e.target.value })} rows={5} className={cn(inputClass, "resize-y")} />
              </Field>
              <Field label="Annexe 2 — Précisions (sous le tableau de l'échéancier)">
                <textarea value={form.annex_pricing} onChange={(e) => set({ annex_pricing: e.target.value })} rows={2} className={cn(inputClass, "resize-y")} />
              </Field>
            </Section>
            </>
            )}

            <Section title="Signatures">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Date de signature">
                  <input type="date" value={form.signing_date ?? ""} onChange={(e) => set({ signing_date: e.target.value || null })} className={inputClass} />
                </Field>
                <Field label={partnership ? "Pour le Partenaire (nom et qualité)" : "Pour le Client (nom et qualité)"}>
                  <input value={form.client_signatory} onChange={(e) => set({ client_signatory: e.target.value })} className={inputClass} />
                </Field>
                <Field label={partnership ? "Pour Soken's Digital" : "Pour le Prestataire"}>
                  <input value={form.provider_signatory} onChange={(e) => set({ provider_signatory: e.target.value })} className={inputClass} />
                </Field>
              </div>
            </Section>
          </fieldset>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={() => router.push(CONTRACTS_PATH)} className="rounded-full px-4">
              Retour
            </Button>
            {!locked && (
              <Button type="submit" disabled={saving || (!partnership && form.payment_schedule.length > 0 && scheduleTotal !== 100)} className="rounded-full px-6">
                {saving ? <Loader2 className="size-4 animate-spin" /> : current ? "Enregistrer" : "Créer le contrat"}
              </Button>
            )}
          </div>
        </form>

        <div className="min-w-0 xl:sticky xl:top-6 xl:self-start">
          <p className={labelClass}>Aperçu</p>
          {previewSettings ? (
            <>
              <ContractPreview contract={preview} settings={previewSettings} />
              <div className="mt-3">
                <span className={labelClass}>Couleur et en-tête</span>
                <div className="flex flex-wrap items-center gap-2">
                  {CONTRACT_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      disabled={locked}
                      onClick={() => set({ document_color: swatch })}
                      aria-label={swatch}
                      className="size-8 rounded-lg transition-shadow disabled:opacity-50"
                      style={{
                        backgroundColor: swatch,
                        boxShadow: form.document_color === swatch ? "0 0 0 2px white, 0 0 0 4px #171717" : undefined,
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => set({ show_header: !form.show_header })}
                    title={form.show_header ? "Retirer le bandeau au logo" : "Remettre le bandeau au logo"}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:opacity-50",
                      form.show_header ? "border-neutral-900 text-neutral-900" : "border-dashed border-neutral-300 text-neutral-500",
                    )}
                  >
                    <PanelTop className="size-3.5" /> {form.show_header ? "En-tête" : "Sans en-tête"}
                  </button>
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

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent title="Paramètres des contrats">
          <ContractSettingsForm
            onSaved={(saved) => {
              setSettingsOpen(false);
              setContext((ctx) => (ctx ? { ...ctx, settings: { ...ctx.settings, ...saved } } : ctx));
            }}
          />
        </SheetContent>
      </Sheet>

      {current && (
        <SendDocumentModal
          open={sendOpen}
          onOpenChange={setSendOpen}
          documentTitle={`${title} ${current.contract_number}`}
          documentNumber={current.contract_number}
          recipientName={current.client_name}
          suggestedEmails={current.client_email ? [current.client_email] : []}
          onSend={async (emails, message) => {
            const sent = await sendServiceContract(current.id, { recipient_emails: emails, message });
            if (sent.email_warning) alert(sent.email_warning);
            setCurrent(sent);
          }}
        />
      )}
    </div>
  );
}
