"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { getTaxRates, updateTaxRates, type ExtraTaxSetting } from "@/lib/api/finance";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles } from "@/lib/firebase/types";
import { useIsGerant } from "@/lib/admin/use-is-gerant";

const pct = (rate: string) => String(Math.round(Number(rate) * 1000) / 10);

/** Taux de TVA et de CSS appliqués par défaut aux nouvelles factures.
 * Modifiables par le Comptable et le Super-Admin ; les factures
 * déjà émises gardent les taux en vigueur à leur émission. */
export function TaxRatesForm() {
  const { profile } = useAuth();
  const roles = profileRoles(profile);
  const isGerant = useIsGerant();
  // Gérant, comptabilité (Comptable) et Super-Admin.
  const canEdit = isGerant || roles.some((r) => ["SUPER_ADMIN", "COMPTABLE"].includes(r));
  const [vat, setVat] = useState<string | null>(null);
  const [css, setCss] = useState("");
  // Autres taxes, en plus de la TVA et de la CSS (ajout / retrait libres).
  const [extras, setExtras] = useState<ExtraTaxSetting[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getTaxRates()
      .then((r) => {
        setVat(pct(r.vat_rate));
        setCss(pct(r.css_rate));
        setExtras(r.extra_taxes ?? []);
      })
      .catch(() => setMessage("Impossible de charger les taux."));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updateTaxRates({
        vat_rate: String((Number(vat) || 0) / 100),
        css_rate: String((Number(css) || 0) / 100),
        extra_taxes: extras.filter((t) => t.name.trim() || Number(t.percent)),
      });
      setMessage("Taux enregistrés : ils s'appliquent aux prochaines factures.");
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as Record<string, unknown> | null) : null;
      const first = body ? (body.detail ?? Object.values(body)[0]) : null;
      setMessage(String(Array.isArray(first) ? first[0] : first ?? "Enregistrement impossible."));
    } finally {
      setSaving(false);
    }
  }

  if (vat === null && !message) return <Loader2 className="mx-auto size-5 animate-spin text-neutral-400" />;

  return (
    <div className="mb-6 space-y-3 rounded-xl border border-neutral-200 p-4">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900">Taux fiscaux par défaut</h3>
        <p className="text-xs text-neutral-500">
          Pré-remplis sur chaque nouvelle facture (modifiables facture par facture). Les factures déjà émises ne changent pas.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>TVA (%)</span>
          <input type="number" inputMode="decimal" step="0.1" min={0} max={100} value={vat ?? ""} disabled={!canEdit} onChange={(e) => setVat(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>CSS (%)</span>
          <input type="number" inputMode="decimal" step="0.1" min={0} max={20} value={css} disabled={!canEdit} onChange={(e) => setCss(e.target.value)} className={inputClass} />
        </label>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className={labelClass}>Autres taxes</span>
          {canEdit && (
            <button
              type="button"
              onClick={() => setExtras((list) => [...list, { name: "", percent: "", enabled: false }])}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Plus className="size-3.5" /> Ajouter une taxe
            </button>
          )}
        </div>
        {extras.length === 0 && <p className="text-xs text-neutral-400">Aucune autre taxe que la TVA et la CSS.</p>}
        <div className="space-y-2">
          {extras.map((tax, i) => {
            const update = (patch: Partial<ExtraTaxSetting>) => setExtras((list) => list.map((t, j) => (j === i ? { ...t, ...patch } : t)));
            return (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_76px_auto_auto] items-center gap-2">
                <input value={tax.name} disabled={!canEdit} onChange={(e) => update({ name: e.target.value })} placeholder="Nom de la taxe" aria-label="Nom de la taxe" className={inputClass} />
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={0}
                  max={100}
                  value={tax.percent}
                  disabled={!canEdit}
                  onChange={(e) => update({ percent: e.target.value })}
                  placeholder="%"
                  aria-label="Taux en %"
                  className={inputClass}
                />
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-neutral-600" title="Appliquée d'office aux nouvelles factures">
                  <input type="checkbox" checked={tax.enabled} disabled={!canEdit} onChange={(e) => update({ enabled: e.target.checked })} className="size-4 accent-primary" />
                  Par défaut
                </label>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setExtras((list) => list.filter((_, j) => j !== i))}
                    aria-label={`Retirer ${tax.name || "la taxe"}`}
                    className="flex size-9 items-center justify-center rounded-lg text-neutral-400 hover:bg-destructive/5 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-neutral-400">
          Calculées sur le total HT et ajoutées au total à payer. Sur chaque facture, on coche celles qui s&apos;appliquent.
        </p>
      </div>
      {message && <p className="text-xs text-neutral-600">{message}</p>}
      {canEdit ? (
        <Button type="button" onClick={handleSave} disabled={saving} className="rounded-full px-5">
          {saving ? "Enregistrement…" : "Enregistrer les taux"}
        </Button>
      ) : (
        <p className="text-xs text-neutral-400">Modifiables par le gérant, la comptabilité et les Super-Admins.</p>
      )}
    </div>
  );
}
