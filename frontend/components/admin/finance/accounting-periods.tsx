"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Lock, Plus, Trash2, Unlock } from "lucide-react";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles } from "@/lib/firebase/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  closeAccountingPeriod,
  createAccountingPeriod,
  deleteAccountingPeriod,
  listAccountingPeriods,
  reopenAccountingPeriod,
} from "@/lib/api/finance";
import type { AccountingPeriod } from "@/lib/api/types";
import { useAutoRefresh } from "@/lib/admin/auto-refresh";

export function AccountingPeriods() {
  const [periods, setPeriods] = useState<AccountingPeriod[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  // Suppression : Super-Admin uniquement, en trois confirmations successives.
  const { profile } = useAuth();
  const isSuperAdmin = profileRoles(profile).includes("SUPER_ADMIN");
  const [deleting, setDeleting] = useState<{ period: AccountingPeriod; step: 1 | 2 | 3 } | null>(null);
  // La fenêtre se ferme après chaque « Continuer » : ce drapeau distingue le
  // passage à l'étape suivante d'une annulation.
  const advancing = useRef(false);

  useAutoRefresh(() => load());
  async function load() {
    try {
      const res = await listAccountingPeriods();
      setPeriods(res.results);
    } catch {
      setError("Impossible de charger les périodes comptables.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(period: AccountingPeriod) {
    setActingId(period.id);
    try {
      if (period.status === "OUVERTE") await closeAccountingPeriod(period.id);
      else await reopenAccountingPeriod(period.id);
      await load();
    } finally {
      setActingId(null);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!periods) {
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
          <h1 className="text-2xl font-semibold text-neutral-900">Clôture comptable</h1>
          <p className="text-sm text-neutral-500">
            Ouverture et verrouillage définitif des exercices/périodes de saisie.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button data-tour="module-finance-cloture" className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Nouvelle période
              </Button>
            }
          />
          <SheetContent title="Nouvelle période comptable">
            <PeriodForm onSaved={() => { setOpen(false); load(); }} />
          </SheetContent>
        </Sheet>
      </div>

      {deleting && (
        <ConfirmModal
          key={deleting.step}
          open
          onOpenChange={(o) => {
            if (o) return;
            if (advancing.current) {
              advancing.current = false;
              return;
            }
            setDeleting(null);
          }}
          title={`Supprimer la période ${deleting.period.label} — confirmation ${deleting.step}/3`}
          description={
            deleting.step === 1
              ? `Voulez-vous supprimer la période comptable « ${deleting.period.label} » (${deleting.period.start_date} → ${deleting.period.end_date}) ?`
              : deleting.step === 2
                ? "Les écritures comptables de la période sont conservées (sans période) et seront rattachées à la prochaine période créée couvrant leurs dates. Le Responsable des Opérations et le Responsable Comptabilité & Finance seront notifiés. Une période clôturée doit d'abord être rouverte. Continuer ?"
                : `Dernière confirmation : saisissez le libellé exact de la période, « ${deleting.period.label} ».`
          }
          confirmLabel={deleting.step === 3 ? "Supprimer définitivement" : "Continuer"}
          requireTyping={deleting.step === 3 ? deleting.period.label : undefined}
          onConfirm={async () => {
            if (deleting.step < 3) {
              advancing.current = true;
              setDeleting({ period: deleting.period, step: (deleting.step + 1) as 2 | 3 });
              return;
            }
            await deleteAccountingPeriod(deleting.period.id, deleting.period.label);
            setDeleting(null);
            load();
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
        <table className="table-responsive w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Période</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {periods.map((period) => (
              <tr key={period.id}>
                <td className="px-4 py-3 text-neutral-900" data-label="Période">{period.label}</td>
                <td className="px-4 py-3 text-neutral-500" data-label="Dates">{period.start_date} → {period.end_date}</td>
                <td className="px-4 py-3" data-label="Statut">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      period.status === "OUVERTE" ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {period.status === "OUVERTE" ? "Ouverte" : "Clôturée"}
                  </span>
                </td>
                <td className="px-4 py-3" data-label="Action">
                  <button
                    disabled={actingId === period.id}
                    onClick={() => toggle(period)}
                    className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 disabled:opacity-40"
                  >
                    {period.status === "OUVERTE" ? <Lock className="size-3" /> : <Unlock className="size-3" />}
                    {period.status === "OUVERTE" ? "Clôturer" : "Rouvrir"}
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeleting({ period, step: 1 })}
                      className="mt-1.5 flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive"
                    >
                      <Trash2 className="size-3" /> Supprimer
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {periods.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  Aucune période créée pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PeriodForm({ onSaved }: { onSaved: () => void }) {
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createAccountingPeriod({ label, start_date: startDate, end_date: endDate });
      onSaved();
    } catch {
      setError("Impossible de créer la période — vérifie les dates et l'unicité du label.");
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
        <span className={labelClass}>Label</span>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="2026-07" className={inputClass} required />
      </label>
      <label className="block">
        <span className={labelClass}>Date de début</span>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} required />
      </label>
      <label className="block">
        <span className={labelClass}>Date de fin</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} required />
      </label>
      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Créer"}
        </Button>
      </div>
    </form>
  );
}
