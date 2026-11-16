"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Loader2, Scale, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { getContractSettings, updateContractSettings, type ContractSettings, type ContractWatermark } from "@/lib/api/contracts";
import { uploadImage } from "@/lib/api/upload";
import { cn } from "@/lib/utils";

const WATERMARKS: { value: ContractWatermark; label: string; hint: string }[] = [
  { value: "BALANCE", label: "Balance", hint: "Le filigrane du modèle" },
  { value: "IMAGE", label: "Image ou logo", hint: "Votre propre image" },
  { value: "AUCUN", label: "Aucun", hint: "Pages sans filigrane" },
];

/** Paramètres communs à tous les contrats : identité du Prestataire,
 * signataire, ville, filigrane de fond de page, cachet. */
export function ContractSettingsForm({ onSaved }: { onSaved: (settings: ContractSettings) => void }) {
  const [settings, setSettings] = useState<ContractSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getContractSettings()
      .then(setSettings)
      .catch(() => setError("Impossible de charger les paramètres des contrats."));
  }, []);

  if (!settings) {
    return error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  const set = (patch: Partial<ContractSettings>) => setSettings({ ...settings, ...patch });

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setSettings((s) => (s ? { ...s, watermark_url: url, watermark: "IMAGE" } : s));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi de l'image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    if (settings.watermark === "IMAGE" && !settings.watermark_url) {
      setError("Ajoutez une image, ou choisissez un autre filigrane.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateContractSettings(settings));
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

      <div>
        <span className={labelClass}>Filigrane des pages</span>
        <div className="grid grid-cols-3 gap-2">
          {WATERMARKS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => set({ watermark: w.value })}
              className={cn(
                "rounded-xl border p-2.5 text-left transition-colors",
                settings.watermark === w.value ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300",
              )}
            >
              <span className="block text-xs font-semibold text-neutral-900">{w.label}</span>
              <span className="block text-[11px] leading-tight text-neutral-500">{w.hint}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
            {settings.watermark === "BALANCE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/assets/contract-balance.svg" alt="Balance" className="size-full object-contain p-1.5" />
            ) : settings.watermark === "IMAGE" && settings.watermark_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.watermark_url}
                alt="Filigrane"
                className="size-full object-contain p-1.5"
                style={{ opacity: settings.watermark_opacity / 100 }}
              />
            ) : settings.watermark === "IMAGE" ? (
              <ImageIcon className="size-5 text-neutral-300" />
            ) : (
              <Scale className="size-5 text-neutral-200" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-1.5 rounded-full px-3.5 text-xs">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
              {settings.watermark_url ? "Changer l'image" : "Envoyer une image ou un logo"}
            </Button>
            {settings.watermark === "IMAGE" && settings.watermark_url && (
              <label className="block">
                <span className="text-[11px] text-neutral-500">Opacité : {settings.watermark_opacity} %</span>
                <input
                  type="range"
                  min={5}
                  max={60}
                  value={settings.watermark_opacity}
                  onChange={(e) => set({ watermark_opacity: Number(e.target.value) })}
                  className="block w-full accent-primary"
                />
              </label>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={handleFile} className="hidden" />
      </div>

      <label className="block">
        <span className={labelClass}>Le Prestataire (paragraphe « Entre les soussignés »)</span>
        <textarea value={settings.provider_identity} onChange={(e) => set({ provider_identity: e.target.value })} rows={5} className={cn(inputClass, "resize-y")} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Signataire (nom et qualité)</span>
          <input value={settings.provider_signatory} onChange={(e) => set({ provider_signatory: e.target.value })} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Ville (signature et juridiction)</span>
          <input value={settings.city} onChange={(e) => set({ city: e.target.value })} className={inputClass} />
        </label>
      </div>

      <label className="flex items-start gap-2.5 rounded-xl border border-neutral-200 p-3">
        <input type="checkbox" checked={settings.apply_stamp} onChange={(e) => set({ apply_stamp: e.target.checked })} className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="block text-sm text-neutral-900">Apposer le cachet / la signature</span>
          <span className="block text-xs text-neutral-500">
            Celui des paramètres des documents (devis et factures), sous « Pour le Prestataire ».
          </span>
        </span>
      </label>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="rounded-full px-6">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
