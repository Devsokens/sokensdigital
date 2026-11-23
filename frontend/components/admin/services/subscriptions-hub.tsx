"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { listAllClients } from "@/lib/api/administration";
import { listMaintainedApps } from "@/lib/api/maintenance";
import {
  POLE_LABELS, QUOTA_LABELS, KIND_LABELS, PERIOD_STATUS_LABELS,
  apiErrorMessage, createOffer, createSubscription, formatFcfa, getServicesDashboard, listOffers,
  listSubscriptions, updateOffer,
  type ServiceOffer, type ServicePole, type ServicesDashboard, type Subscription,
} from "@/lib/api/services";
import { cn } from "@/lib/utils";

function basePath(pole: ServicePole) {
  return pole === "COMMUNICATION" ? "/admin/marketing/abonnements" : "/admin/technique/abonnements";
}

export function quotaSummary(quotas: Record<string, number>) {
  return Object.entries(quotas)
    .filter(([k]) => QUOTA_LABELS[k])
    .map(([k, v]) => `${v} ${QUOTA_LABELS[k]}`)
    .join(" · ");
}

export function SubscriptionsHub({ pole }: { pole: ServicePole }) {
  const [subs, setSubs] = useState<Subscription[] | null>(null);
  const [dash, setDash] = useState<ServicesDashboard | null>(null);
  const [offers, setOffers] = useState<ServiceOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    Promise.all([listSubscriptions(pole), getServicesDashboard(pole), listOffers(pole)])
      .then(([s, d, o]) => {
        setSubs(s.results);
        setDash(d);
        setOffers(o.results);
      })
      .catch((e) => setError(apiErrorMessage(e, "Impossible de charger les abonnements.")));
  }, [pole]);

  useEffect(() => load(), [load]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!subs || !dash) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const alerts = [
    ...dash.unpaid_started.map((r) => ({ key: `u${r.period}`, href: `${basePath(pole)}/${r.subscription}`, text: `${r.client} — mois entamé sans règlement (${r.invoice_number ?? "facture"})`, tone: "rose" })),
    ...dash.pace_alerts.map((r) => ({ key: `p${r.period}`, href: `${basePath(pole)}/${r.subscription}`, text: `${r.client} — ${Math.round((r.ratio ?? 0) * 100)} % produit à ${Math.round((r.elapsed ?? 0) * 100)} % du mois`, tone: "amber" })),
    ...dash.unclosed_overdue.map((r) => ({ key: `c${r.period}`, href: `${basePath(pole)}/${r.subscription}`, text: `${r.client} — période terminée non clôturée (rapport manquant)`, tone: "amber" })),
    ...dash.renewals_due.map((r) => ({ key: `r${r.subscription}`, href: `${basePath(pole)}/${r.subscription}`, text: `${r.client} — ${r.offer} à renouveler avant le ${new Date(r.period_end).toLocaleDateString("fr-FR")}`, tone: "amber" })),
    ...dash.sla_overdue.map((t) => ({ key: `t${t.ticket}`, href: "/admin/technique/maintenance", text: `${t.client} — ticket « ${t.title} » sans réponse depuis plus de ${t.sla_hours} h`, tone: "rose" })),
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Abonnements — {POLE_LABELS[pole]}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-neutral-500">
            Une facture par période, réglée en une fois : le quota du mois s&apos;ouvre au paiement complet. Toute demande
            hors formule passe par un devis complémentaire.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="rounded-full">
          <Plus className="size-4" /> Nouvel abonnement
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Abonnements actifs" value={String(dash.active_count)} />
        <Kpi label="Revenu mensuel récurrent" value={formatFcfa(dash.mrr[pole] ?? 0)} />
        <Kpi label="Mois impayés entamés" value={String(dash.unpaid_started.length)} danger={dash.unpaid_started.length > 0} />
        <Kpi label="Alertes de rythme" value={String(dash.pace_alerts.length)} danger={dash.pace_alerts.length > 0} />
      </div>

      {alerts.length > 0 && (
        <div className="mb-6 space-y-1.5">
          {alerts.map((a) => (
            <Link
              key={a.key}
              href={a.href}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs",
                a.tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800",
              )}
            >
              <AlertTriangle className="size-3.5 shrink-0" /> {a.text}
            </Link>
          ))}
        </div>
      )}

      <Tabs defaultValue="abonnements">
        <TabsList>
          <TabsTab value="abonnements">Abonnements</TabsTab>
          <TabsTab value="catalogue">Catalogue &amp; tarifs</TabsTab>
        </TabsList>
        <TabsPanel value="abonnements" className="pt-4">
          <SubscriptionTable subs={subs} pole={pole} />
        </TabsPanel>
        <TabsPanel value="catalogue" className="pt-4">
          <OfferCatalogue offers={offers} pole={pole} onChange={load} />
        </TabsPanel>
      </Tabs>

      {creating && (
        <NewSubscriptionSheet
          pole={pole}
          offers={offers.filter((o) => o.is_active && o.kind !== "PONCTUEL")}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">{label}</p>
      <p className={cn("mt-1.5 text-xl font-semibold", danger ? "text-rose-600" : "text-neutral-900")}>{value}</p>
    </div>
  );
}

function SubscriptionTable({ subs, pole }: { subs: Subscription[]; pole: ServicePole }) {
  if (subs.length === 0) {
    return <p className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">Aucun abonnement pour l&apos;instant.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
      <table className="table-responsive w-full text-sm">
        <thead className="bg-neutral-50 text-left text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
          <tr>
            <th className="px-5 py-3">Client</th>
            <th className="px-5 py-3">Formule</th>
            <th className="px-5 py-3">Prix TTC</th>
            <th className="px-5 py-3">Période en cours</th>
            <th className="px-5 py-3">Consommation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {subs.map((s) => {
            const p = s.current_period;
            return (
              <tr key={s.id} className="hover:bg-neutral-50">
                <td className="px-5 py-3.5" data-label="Client">
                  <Link href={`${basePath(pole)}/${s.id}`} className="font-medium text-neutral-900 hover:text-primary">
                    {s.client_name}
                  </Link>
                  {s.status !== "ACTIVE" && <span className="ml-2 text-xs text-neutral-400">({s.status.toLowerCase()})</span>}
                  {s.maintained_app_name && <span className="block text-xs text-neutral-400">{s.maintained_app_name}</span>}
                </td>
                <td className="px-5 py-3.5" data-label="Formule">
                  {s.offer_name} <span className="text-xs text-neutral-400">· {KIND_LABELS[s.kind]}</span>
                </td>
                <td className="px-5 py-3.5" data-label="Prix TTC">{formatFcfa(s.price)}</td>
                <td className="px-5 py-3.5" data-label="Période">
                  {p ? (
                    <span className="text-xs">
                      {new Date(p.period_start).toLocaleDateString("fr-FR")} → {new Date(p.period_end).toLocaleDateString("fr-FR")}
                      <span className={cn("ml-2 rounded-full px-2 py-0.5 font-semibold", p.status === "OUVERT" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                        {PERIOD_STATUS_LABELS[p.status]}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-400">Aucune — générer la facture</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-xs text-neutral-600" data-label="Consommation">
                  {p && p.status === "OUVERT"
                    ? Object.entries(p.quotas_alloues).filter(([k]) => k !== "reseaux" && QUOTA_LABELS[k]).map(([k, v]) => `${p.consumed[k] ?? 0}/${v} ${QUOTA_LABELS[k]}`).join(" · ") || "—"
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NewSubscriptionSheet({
  pole, offers, onClose, onCreated,
}: { pole: ServicePole; offers: ServiceOffer[]; onClose: () => void; onCreated: () => void }) {
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
  const [apps, setApps] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ client: "", offer: offers[0]?.id ?? "", start_date: new Date().toISOString().slice(0, 10), maintained_app: "", networks: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAllClients().then((r) => setClients(r.results)).catch(() => setClients([]));
    if (pole === "MAINTENANCE") listMaintainedApps().then((r) => setApps(r.results)).catch(() => setApps([]));
  }, [pole]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await createSubscription({
        client: form.client,
        offer: form.offer,
        start_date: form.start_date,
        maintained_app: form.maintained_app || null,
        networks: form.networks.split(",").map((n) => n.trim()).filter(Boolean),
        notes: form.notes,
      });
      onCreated();
    } catch (e) {
      setError(apiErrorMessage(e, "Impossible de créer l'abonnement."));
    } finally {
      setSaving(false);
    }
  }

  const offer = offers.find((o) => o.id === form.offer);
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent title="Nouvel abonnement">
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>Client</span>
            <select className={inputClass} value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
              <option value="">— Choisir —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>Formule</span>
            <select className={inputClass} value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })}>
              {offers.map((o) => <option key={o.id} value={o.id}>{o.name} — {formatFcfa(o.price_ttc)} ({KIND_LABELS[o.kind].toLowerCase()})</option>)}
            </select>
            {offer && <span className="mt-1 block text-xs text-neutral-500">{quotaSummary(offer.quotas) || offer.features}</span>}
          </label>
          <label className="block">
            <span className={labelClass}>Début de la première période</span>
            <input type="date" className={inputClass} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </label>
          {pole === "MAINTENANCE" ? (
            <label className="block">
              <span className={labelClass}>Application maintenue (facultatif)</span>
              <select className={inputClass} value={form.maintained_app} onChange={(e) => setForm({ ...form, maintained_app: e.target.value })}>
                <option value="">—</option>
                {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className={labelClass}>Réseaux couverts (séparés par des virgules)</span>
              <input className={inputClass} value={form.networks} placeholder="Facebook, Instagram" onChange={(e) => setForm({ ...form, networks: e.target.value })} />
            </label>
          )}
          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea className={inputClass} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button disabled={saving || !form.client || !form.offer} onClick={submit} className="w-full rounded-full">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <><Repeat className="size-4" /> Créer l&apos;abonnement</>}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function OfferCatalogue({ offers, pole, onChange }: { offers: ServiceOffer[]; pole: ServicePole; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<ServiceOffer> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotasText, setQuotasText] = useState("{}");

  function open(o: Partial<ServiceOffer>) {
    setEditing(o);
    setQuotasText(JSON.stringify(o.quotas ?? {}));
    setError(null);
  }

  async function save() {
    if (!editing) return;
    let quotas: Record<string, number>;
    try {
      quotas = JSON.parse(quotasText || "{}");
    } catch {
      setError("Quotas : format JSON invalide.");
      return;
    }
    try {
      const data = { ...editing, quotas, pole };
      if (editing.id) await updateOffer(editing.id, data);
      else await createOffer(data);
      setEditing(null);
      onChange();
    } catch (e) {
      setError(apiErrorMessage(e, "Enregistrement impossible (réservé au responsable du pôle)."));
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="outline" className="rounded-full" onClick={() => open({ kind: "MENSUEL", is_active: true, price_ttc: "0" })}>
          <Plus className="size-4" /> Nouvelle offre
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {offers.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => open(o)}
            className={cn("rounded-xl border bg-white p-4 text-left shadow-sm hover:border-primary/40", !o.is_active && "opacity-50")}
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-semibold text-neutral-900">{o.name}</p>
              <p className="shrink-0 text-sm font-semibold text-primary">
                {formatFcfa(o.price_ttc)}
                <span className="text-xs font-normal text-neutral-400">{o.kind === "MENSUEL" ? " /mois" : o.kind === "ANNUEL" ? " /an" : ""}</span>
              </p>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{quotaSummary(o.quotas) || o.features || KIND_LABELS[o.kind]}</p>
            {o.response_sla_hours && <p className="mt-1 text-xs text-neutral-400">Réponse sous {o.response_sla_hours} h</p>}
          </button>
        ))}
      </div>

      {editing && (
        <Sheet open onOpenChange={(v) => !v && setEditing(null)}>
          <SheetContent title={editing.id ? `Offre — ${editing.name}` : "Nouvelle offre"}>
            <div className="space-y-3">
              {!editing.id && (
                <label className="block">
                  <span className={labelClass}>Code (unique, sans espace)</span>
                  <input className={inputClass} value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
                </label>
              )}
              <label className="block">
                <span className={labelClass}>Nom</span>
                <input className={inputClass} value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Type</span>
                  <select className={inputClass} value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as ServiceOffer["kind"] })}>
                    {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Prix TTC (FCFA)</span>
                  <input type="number" className={inputClass} value={editing.price_ttc ?? ""} onChange={(e) => setEditing({ ...editing, price_ttc: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>Quotas par période (JSON : publications, videos, campagnes, reseaux, heures_modif)</span>
                <input className={cn(inputClass, "font-mono text-xs")} value={quotasText} onChange={(e) => setQuotasText(e.target.value)} />
              </label>
              {pole === "MAINTENANCE" && (
                <label className="block">
                  <span className={labelClass}>Délai de réponse (heures)</span>
                  <input type="number" className={inputClass} value={editing.response_sla_hours ?? ""} onChange={(e) => setEditing({ ...editing, response_sla_hours: e.target.value ? Number(e.target.value) : null })} />
                </label>
              )}
              <label className="block">
                <span className={labelClass}>Description</span>
                <textarea className={inputClass} rows={3} value={editing.features ?? ""} onChange={(e) => setEditing({ ...editing, features: e.target.value })} />
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={Boolean(editing.requires_meeting)} onChange={(e) => setEditing({ ...editing, requires_meeting: e.target.checked })} />
                Réunion de restitution obligatoire à la clôture
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={editing.is_active !== false} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} />
                Offre active
              </label>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button onClick={save} className="w-full rounded-full">Enregistrer</Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
