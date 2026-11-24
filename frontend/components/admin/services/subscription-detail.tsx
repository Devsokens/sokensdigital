"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles } from "@/lib/firebase/types";
import { ArrowLeft, CheckCircle2, FileText, Loader2, Plus, Receipt, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  DELIVERABLE_KIND_LABELS, DELIVERABLE_STATUS_LABELS, KINDS_BY_POLE, PERIOD_STATUS_LABELS, QUOTA_LABELS,
  apiErrorMessage, closePeriod, createDeliverable, deleteDeliverable, deleteSubscription, formatFcfa, generateInvoice, getSubscription,
  listPeriods, transitionDeliverable, updateSubscription,
  type Deliverable, type DeliverableKind, type DeliverableStatus, type ServicePeriod, type Subscription,
} from "@/lib/api/services";
import { cn } from "@/lib/utils";
import { useAutoRefresh } from "@/lib/admin/auto-refresh";

// Étape suivante du circuit de validation (la maintenance « livre », la
// communication « publie »).
function nextSteps(d: Deliverable, pole: Subscription["pole"]): DeliverableStatus[] {
  switch (d.status) {
    case "BROUILLON": return ["CONTROLE_INTERNE"];
    case "CONTROLE_INTERNE": return pole === "MAINTENANCE" ? ["LIVRE", "BROUILLON"] : ["VALIDE_CLIENT", "BROUILLON"];
    case "VALIDE_CLIENT": return [pole === "MAINTENANCE" ? "LIVRE" : "PUBLIE", "BROUILLON"];
    default: return [];
  }
}

const STATUS_TONE: Record<DeliverableStatus, string> = {
  BROUILLON: "bg-neutral-100 text-neutral-600",
  CONTROLE_INTERNE: "bg-sky-100 text-sky-700",
  VALIDE_CLIENT: "bg-violet-100 text-violet-700",
  PUBLIE: "bg-emerald-100 text-emerald-700",
  LIVRE: "bg-emerald-100 text-emerald-700",
};

export function SubscriptionDetail({ id, backHref }: { id: string; backHref: string }) {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [periods, setPeriods] = useState<ServicePeriod[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [closing, setClosing] = useState<ServicePeriod | null>(null);
  const router = useRouter();
  // Suppression réservée au Super-Admin (le serveur refuse les autres).
  const { profile } = useAuth();
  const isSuperAdmin = profileRoles(profile).includes("SUPER_ADMIN");

  const load = useCallback(() => {
    Promise.all([getSubscription(id), listPeriods(id)])
      .then(([s, p]) => {
        setSub(s);
        setPeriods(p);
      })
      .catch((e) => setError(apiErrorMessage(e, "Abonnement introuvable.")));
  }, [id]);

  useEffect(() => load(), [load]);
  useAutoRefresh(load);

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (ok) setNotice(ok);
      load();
    } catch (e) {
      setNotice(apiErrorMessage(e, "Action impossible."));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!sub || !periods) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <Link href={backHref} className="mb-4 inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800">
        <ArrowLeft className="size-3.5" /> Abonnements
      </Link>
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-neutral-900">{sub.client_name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {sub.offer_name} · {formatFcfa(sub.price)} TTC {sub.kind === "ANNUEL" ? "/an" : "/mois"}
            {sub.maintained_app_name && ` · ${sub.maintained_app_name}`}
            {sub.networks.length > 0 && ` · ${sub.networks.join(", ")}`}
            {sub.quote_number && ` · devis ${sub.quote_number}`}
          </p>
        </div>
        <select
          className={cn(inputClass, "w-auto")}
          value={sub.status}
          onChange={(e) => run(() => updateSubscription(sub.id, { status: e.target.value as Subscription["status"] }), "Statut mis à jour.")}
        >
          <option value="ACTIVE">Actif</option>
          <option value="SUSPENDU">Suspendu</option>
          <option value="RESILIE">Résilié</option>
        </select>
        <Button disabled={busy || sub.status !== "ACTIVE"} onClick={() => run(() => generateInvoice(sub.id), "Facture brouillon créée : à valider et encaisser en Finance.")} className="rounded-full">
          <Receipt className="size-4" /> Générer la facture {sub.kind === "ANNUEL" ? "de l'année" : "du mois"}
        </Button>
        {isSuperAdmin && (
          <ConfirmModal
            title="Supprimer l'abonnement"
            description={`L'abonnement « ${sub.offer_name} » de ${sub.client_name} sera supprimé définitivement, avec ses ${periods.length} période(s), leurs livrables et leurs factures (versements, reçus, écritures comptables compris). Refusé si une facture est dans une période comptable clôturée, rapprochée en banque ou encaissée en trésorerie.`}
            confirmLabel="Supprimer"
            requireTyping="SUPPRIMER"
            onConfirm={async () => {
              await deleteSubscription(sub.id);
              router.push(backHref);
            }}
            trigger={
              <Button variant="outline" className="rounded-full text-destructive">
                <Trash2 className="size-4" /> Supprimer
              </Button>
            }
          />
        )}
      </div>

      {notice && <p className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs text-neutral-700">{notice}</p>}

      {periods.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
          Aucune période : générez la première facture. Le quota s&apos;ouvrira dès son paiement complet.
        </p>
      )}

      <div className="space-y-5">
        {periods.map((p) => (
          <PeriodCard key={p.id} period={p} sub={sub} busy={busy} run={run} onClose={() => setClosing(p)} />
        ))}
      </div>

      {closing && (
        <ClosePeriodSheet
          period={closing}
          onClose={() => setClosing(null)}
          onDone={() => {
            setClosing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PeriodCard({
  period: p, sub, busy, run, onClose,
}: {
  period: ServicePeriod; sub: Subscription; busy: boolean;
  run: (fn: () => Promise<unknown>, ok?: string) => void; onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const kinds = KINDS_BY_POLE[sub.pole];
  const [form, setForm] = useState<{ kind: DeliverableKind; title: string; quantity: string; network: string }>({
    kind: kinds[0], title: "", quantity: "1", network: "",
  });
  const quotaKeys = Object.keys(p.quotas_alloues).filter((k) => k !== "reseaux" && QUOTA_LABELS[k]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-3 border-b border-neutral-100 px-5 py-3.5">
        <p className="font-semibold text-neutral-900">
          {new Date(p.period_start).toLocaleDateString("fr-FR")} → {new Date(p.period_end).toLocaleDateString("fr-FR")}
        </p>
        <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
          p.status === "OUVERT" ? "bg-emerald-100 text-emerald-700" : p.status === "CLOTURE" ? "bg-neutral-100 text-neutral-600" : "bg-amber-100 text-amber-700")}>
          {PERIOD_STATUS_LABELS[p.status]}
        </span>
        {p.invoice && (
          <Link href={`/admin/finance/facturation/${p.invoice}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <FileText className="size-3.5" /> {p.invoice_number} · payé {formatFcfa(p.invoice_amount_paid)} / {formatFcfa(p.invoice_amount_ttc)}
          </Link>
        )}
        <span className="flex-1" />
        {p.status === "OUVERT" && (
          <>
            <Button variant="outline" className="rounded-full" onClick={() => setAdding((v) => !v)}>
              <Plus className="size-4" /> Livrable
            </Button>
            <Button className="rounded-full" onClick={onClose}>
              <CheckCircle2 className="size-4" /> Clôturer
            </Button>
          </>
        )}
      </header>

      <div className="px-5 py-4">
        {p.status === "EN_ATTENTE_PAIEMENT" && (
          <p className="text-xs text-amber-700">Production bloquée : la facture de la période doit être entièrement payée.</p>
        )}
        {quotaKeys.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {quotaKeys.map((k) => {
              const total = p.quotas_alloues[k];
              const used = p.consumed[k] ?? 0;
              return (
                <div key={k}>
                  <p className="text-xs text-neutral-500">{QUOTA_LABELS[k]}</p>
                  <p className="text-sm font-semibold text-neutral-900">{used} / {total}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-neutral-100">
                    <div className={cn("h-1.5 rounded-full", used >= total ? "bg-rose-500" : "bg-primary")} style={{ width: `${Math.min(100, (used / (total || 1)) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {p.carry_over?.carried && (
          <p className="mb-3 text-xs text-neutral-500">
            Report exceptionnel vers la période suivante : {Object.entries(p.carry_over.carried).map(([k, v]) => `${v} ${QUOTA_LABELS[k] ?? k}`).join(", ")} — {p.carry_over.reason}
          </p>
        )}
        {p.status === "CLOTURE" && (
          <p className="mb-3 text-xs text-neutral-500">
            Rapport : {/^https?:\/\//i.test(p.report_url) ? <a href={p.report_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{p.report_url}</a> : p.report_notes}
            {p.meeting_held && " · réunion tenue"}
          </p>
        )}

        {adding && (
          <div className="mb-4 grid gap-2 rounded-lg border border-neutral-200 p-3 md:grid-cols-[1fr_2fr_90px_1fr_auto]">
            <select className={inputClass} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as DeliverableKind })}>
              {kinds.map((k) => <option key={k} value={k}>{DELIVERABLE_KIND_LABELS[k]}</option>)}
            </select>
            <input className={inputClass} placeholder="Intitulé" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input type="number" min="0.25" step="0.25" className={inputClass} title={form.kind === "MODIFICATION_HEURES" ? "Heures" : "Quantité"} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
            <input className={inputClass} placeholder={sub.pole === "COMMUNICATION" ? "Réseau" : "—"} value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} />
            <Button
              disabled={busy || !form.title}
              className="rounded-full"
              onClick={() => run(async () => {
                await createDeliverable({ period: p.id, ...form });
                setForm({ ...form, title: "" });
              })}
            >
              Ajouter
            </Button>
          </div>
        )}

        {p.deliverables.length === 0 ? (
          <p className="text-xs text-neutral-400">Aucun livrable.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {p.deliverables.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-neutral-900">{d.title}</span>
                  <span className="ml-2 text-xs text-neutral-400">
                    {DELIVERABLE_KIND_LABELS[d.kind]}{Number(d.quantity) !== 1 && ` × ${Number(d.quantity)}`}{d.network && ` · ${d.network}`}
                  </span>
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[d.status])}>{DELIVERABLE_STATUS_LABELS[d.status]}</span>
                {p.status === "OUVERT" && nextSteps(d, sub.pole).map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => run(() => transitionDeliverable(d.id, s))}
                    className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                      s === "BROUILLON" ? "border-neutral-200 text-neutral-500" : "border-primary/40 text-primary hover:bg-primary/5")}
                  >
                    {s === "BROUILLON" ? "Renvoyer en brouillon" : `→ ${DELIVERABLE_STATUS_LABELS[s]}`}
                  </button>
                ))}
                {p.status === "OUVERT" && !["PUBLIE", "LIVRE"].includes(d.status) && (
                  <button type="button" disabled={busy} onClick={() => run(() => deleteDeliverable(d.id))} className="text-neutral-400 hover:text-destructive" aria-label="Supprimer">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ClosePeriodSheet({ period, onClose, onDone }: { period: ServicePeriod; onClose: () => void; onDone: () => void }) {
  const [reportUrl, setReportUrl] = useState("");
  const [reportNotes, setReportNotes] = useState("");
  const [meeting, setMeeting] = useState(false);
  const [carry, setCarry] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const leftovers = Object.entries(period.remaining).filter(([k, v]) => v > 0 && QUOTA_LABELS[k] && k !== "reseaux");

  async function submit() {
    setSaving(true);
    setError(null);
    const carry_over: Record<string, number> = {};
    for (const [k, v] of Object.entries(carry)) if (Number(v) > 0) carry_over[k] = Number(v);
    try {
      await closePeriod(period.id, {
        report_url: reportUrl.trim() || undefined,
        report_notes: reportNotes,
        meeting_held: meeting,
        carry_over: Object.keys(carry_over).length ? carry_over : undefined,
        carry_reason: reason,
      });
      onDone();
    } catch (e) {
      setError(apiErrorMessage(e, "Clôture impossible."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title="Clôturer la période">
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>Lien du rapport mensuel</span>
            <input className={inputClass} placeholder="https://…" value={reportUrl} onChange={(e) => setReportUrl(e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>Ou compte rendu (livrables, campagnes, retours)</span>
            <textarea className={inputClass} rows={4} value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={meeting} onChange={(e) => setMeeting(e.target.checked)} /> Réunion de restitution tenue
          </label>
          {leftovers.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-xs text-amber-800">
                Quotas non consommés : perdus à la clôture, sauf report exceptionnel motivé (tracé dans l&apos;audit).
              </p>
              {leftovers.map(([k, v]) => (
                <label key={k} className="mb-1.5 flex items-center gap-2 text-xs text-neutral-700">
                  <input type="number" min="0" max={v} className={cn(inputClass, "w-20")} value={carry[k] ?? ""} onChange={(e) => setCarry({ ...carry, [k]: e.target.value })} />
                  / {v} {QUOTA_LABELS[k]} à reporter
                </label>
              ))}
              <input className={cn(inputClass, "mt-1")} placeholder="Motif du report" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button disabled={saving} onClick={submit} className="w-full rounded-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Clôturer"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
