"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { ApiError } from "@/lib/api/client";
import { ImageUploadField } from "@/components/admin/marketing/page-section-editor";
import { getSiteSettingsAdmin, updateSiteSettings } from "@/lib/api/marketing";
import type { SiteServiceLink, SiteSettings, SiteSocialLink } from "@/lib/api/types";

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Retirer" className="shrink-0 text-neutral-400 hover:text-destructive">
      <Trash2 className="size-4" />
    </button>
  );
}

function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
    >
      <Plus className="size-3.5" /> {label}
    </button>
  );
}

export function SiteSettingsForm() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    getSiteSettingsAdmin().then(setSettings).catch(() => setError("Impossible de charger les paramètres du site."));
  }, []);

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateSiteSettings(settings);
      setSettings(updated);
      setSavedAt(Date.now());
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === "object") {
        const fieldErrors = Object.entries(err.body as Record<string, unknown>)
          .map(([field, msgs]) => `${field} : ${Array.isArray(msgs) ? msgs.join(" ") : String(msgs)}`)
          .join(" — ");
        setError(fieldErrors || "Impossible d'enregistrer les paramètres.");
      } else {
        setError("Impossible d'enregistrer les paramètres.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (error && !settings) return <p className="text-sm text-destructive">{error}</p>;
  if (!settings) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Header &amp; Footer</h1>
        <p className="text-sm text-neutral-500">
          Le logo, la signature et les liens affichés en haut et en bas de chaque page publique.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-neutral-200 p-5">
        <span className={labelClass}>Logo</span>
        <div className="flex items-center gap-3">
          <ImageUploadField value={settings.logo_url} onChange={(url) => set("logo_url", url)} />
          <p className="text-xs text-neutral-500">Laisse vide pour garder le logo par défaut du site.</p>
        </div>

        <label className="mt-4 block">
          <span className={labelClass}>Signature (sous le logo, en pied de page)</span>
          <textarea value={settings.tagline} onChange={(e) => set("tagline", e.target.value)} className={`${inputClass} min-h-16`} />
        </label>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <span className={labelClass}>Navigation (en-tête et pied de page)</span>
        <div className="space-y-2">
          {settings.nav_links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={link.label}
                onChange={(e) => set("nav_links", settings.nav_links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
                className={`${inputClass} w-36`}
                placeholder="Libellé"
              />
              <input
                value={link.href}
                onChange={(e) => set("nav_links", settings.nav_links.map((l, j) => (j === i ? { ...l, href: e.target.value } : l)))}
                className={inputClass}
                placeholder="/lien ou #ancre"
              />
              <RemoveButton onClick={() => set("nav_links", settings.nav_links.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <AddRowButton label="Ajouter un lien" onClick={() => set("nav_links", [...settings.nav_links, { label: "", href: "" }])} />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <span className={labelClass}>Services (colonne du pied de page)</span>
        <div className="space-y-2">
          {settings.services_links.map((service, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={service.label}
                onChange={(e) => set("services_links", settings.services_links.map((s, j) => (j === i ? { label: e.target.value } : s)))}
                className={inputClass}
                placeholder="Libellé du service"
              />
              <RemoveButton onClick={() => set("services_links", settings.services_links.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <AddRowButton label="Ajouter un service" onClick={() => set("services_links", [...settings.services_links, { label: "" } as SiteServiceLink])} />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <span className={labelClass}>Liens légaux</span>
        <div className="space-y-2">
          {settings.legal_links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={link.label}
                onChange={(e) => set("legal_links", settings.legal_links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)))}
                className={`${inputClass} w-56`}
                placeholder="Libellé"
              />
              <input
                value={link.href}
                onChange={(e) => set("legal_links", settings.legal_links.map((l, j) => (j === i ? { ...l, href: e.target.value } : l)))}
                className={inputClass}
                placeholder="/lien"
              />
              <RemoveButton onClick={() => set("legal_links", settings.legal_links.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <AddRowButton label="Ajouter un lien" onClick={() => set("legal_links", [...settings.legal_links, { label: "", href: "" }])} />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <span className={labelClass}>Réseaux sociaux</span>
        <div className="space-y-2">
          {settings.social_links.map((social, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={social.icon}
                onChange={(e) => set("social_links", settings.social_links.map((s, j) => (j === i ? { ...s, icon: e.target.value } : s)))}
                className={`${inputClass} w-36`}
                placeholder="Icône (ex: globe)"
              />
              <input
                value={social.url}
                onChange={(e) => set("social_links", settings.social_links.map((s, j) => (j === i ? { ...s, url: e.target.value } : s)))}
                className={inputClass}
                placeholder="https:// ou mailto:"
              />
              <RemoveButton onClick={() => set("social_links", settings.social_links.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
        <div className="mt-2">
          <AddRowButton label="Ajouter un réseau" onClick={() => set("social_links", [...settings.social_links, { icon: "globe", url: "" } as SiteSocialLink])} />
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>Mention de copyright</span>
        <input value={settings.copyright_text} onChange={(e) => set("copyright_text", e.target.value)} className={inputClass} />
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
        </Button>
        {savedAt && <span className="text-xs text-neutral-500">Enregistré.</span>}
      </div>
    </form>
  );
}
