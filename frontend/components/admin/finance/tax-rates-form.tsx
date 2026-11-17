"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { getTaxRates, updateTaxRates } from "@/lib/api/finance";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles } from "@/lib/firebase/types";

const pct = (rate: string) => String(Math.round(Number(rate) * 1000) / 10);

/** Taux de TVA et de CSS appliqués par défaut aux nouvelles factures.
 * Modifiables par le Directeur financier et le Super-Admin ; les factures
 * déjà émises gardent les taux en vigueur à leur émission. */
export function TaxRatesForm() {
  const { profile } = useAuth();
  const roles = profileRoles(profile);
  const canEdit = roles.includes("SUPER_ADMIN") || roles.includes("DIRECTEUR_FINANCIER");
  const [vat, setVat] = useState<string | null>(null);
  const [css, setCss] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getTaxRates()
      .then((r) => {
        setVat(pct(r.vat_rate));
        setCss(pct(r.css_rate));
      })
      .catch(() => setMessage("Impossible de charger les taux."));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await updateTaxRates({ vat_rate: String((Number(vat) || 0) / 100), css_rate: String((Number(css) || 0) / 100) });
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
      {message && <p className="text-xs text-neutral-600">{message}</p>}
      {canEdit ? (
        <Button type="button" onClick={handleSave} disabled={saving} className="rounded-full px-5">
          {saving ? "Enregistrement…" : "Enregistrer les taux"}
        </Button>
      ) : (
        <p className="text-xs text-neutral-400">Modifiables par le Directeur financier ou le Super-Admin.</p>
      )}
    </div>
  );
}
