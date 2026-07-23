"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { ImageUploadField, EditableInput } from "@/components/admin/marketing/page-section-editor";
import { IconPicker, SectionIcon } from "@/components/admin/marketing/icon-picker";
import { NAV_LINKS } from "@/lib/site-nav";
import { getSiteSettingsAdmin, updateSiteSettings } from "@/lib/api/marketing";
import type { SiteServiceLink, SiteSettings, SiteSocialLink } from "@/lib/api/types";

function RemoveDot({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Retirer" className="text-muted-foreground/50 hover:text-destructive">
      <Trash2 className="size-3.5" />
    </button>
  );
}

function AddRow({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
      <Plus className="size-3" /> {label}
    </button>
  );
}

export function SiteSettingsForm() {
  const [saved, setSaved] = useState<SiteSettings | null>(null);
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSiteSettingsAdmin()
      .then((data) => {
        setSaved(data);
        setForm(data);
      })
      .catch(() => setError("Impossible de charger les paramètres du site."));
  }, []);

  function set<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function startEditing() {
    setForm(saved);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setForm(saved);
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (!form) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateSiteSettings(form);
      setSaved(updated);
      setForm(updated);
      setEditing(false);
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

  if (error && !saved) return <p className="text-sm text-destructive">{error}</p>;
  if (!saved || !form) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const data = editing ? form : saved;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2.5">
        <span className="text-xs font-semibold tracking-wider text-neutral-500 uppercase">
          Header &amp; Footer
        </span>
        {editing ? (
          <div className="flex items-center gap-2">
            <button onClick={cancel} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">
              Annuler
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <Loader2 className="size-3 animate-spin" />}
              Enregistrer
            </button>
          </div>
        ) : (
          <button
            onClick={startEditing}
            className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 hover:border-primary/40 hover:text-primary"
          >
            Modifier
          </button>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      <div className="p-6 sm:p-8">
        <p className="mb-4 text-sm text-neutral-500">
          Reproduction fidèle de l&apos;en-tête et du pied de page publics. La navigation (
          {NAV_LINKS.map((l) => l.label).join(", ")}) est une structure fixe du site, non éditable ici.
        </p>

        {/* Faithful reproduction, dark like the public site */}
        <div className="overflow-hidden rounded-2xl bg-[#0a0e13]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <span className="text-sm font-semibold tracking-tight text-foreground">Soken&apos;s Digital</span>
            <nav className="hidden items-center gap-6 sm:flex">
              {NAV_LINKS.map((link) => (
                <span key={link.label} className="text-xs text-foreground/70">{link.label}</span>
              ))}
            </nav>
            <span className="rounded-full bg-primary px-3 py-1.5 text-[10px] font-semibold tracking-wide text-primary-foreground uppercase">
              Démarrer un Projet
            </span>
          </div>

          {/* Footer */}
          <div className="grid grid-cols-1 gap-8 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
            <div className="lg:col-span-1">
              {editing ? (
                <div className="flex items-center gap-2">
                  <ImageUploadField value={data.logo_url} onChange={(url) => set("logo_url", url)} />
                  <span className="text-[0.65rem] text-muted-foreground/60">Laisse vide pour garder le logo par défaut.</span>
                </div>
              ) : data.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.logo_url} alt="" className="h-7 w-auto object-contain" />
              ) : (
                <span className="text-sm font-semibold text-foreground">Soken&apos;s Digital</span>
              )}
              {editing ? (
                <EditableInput
                  value={data.tagline} onChange={(v) => set("tagline", v)}
                  className="mt-4 block w-full max-w-xs text-sm text-muted-foreground" placeholder="Signature"
                />
              ) : (
                <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{data.tagline}</p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {data.social_links.map((social, i) => (
                  <div key={i} className="group relative">
                    {editing ? (
                      <div className="flex items-center gap-1 rounded-full bg-white/[0.06] py-1 pr-1 pl-2 ring-1 ring-white/10">
                        <IconPicker value={social.icon} onChange={(icon) => set("social_links", data.social_links.map((s, j) => (j === i ? { ...s, icon } : s)))} />
                        <EditableInput
                          value={social.url} onChange={(url) => set("social_links", data.social_links.map((s, j) => (j === i ? { ...s, url } : s)))}
                          className="w-32 text-[10px] text-muted-foreground" placeholder="https:// ou mailto:"
                        />
                        <RemoveDot onClick={() => set("social_links", data.social_links.filter((_, j) => j !== i))} />
                      </div>
                    ) : (
                      <span className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-foreground/80">
                        <SectionIcon name={social.icon} className="size-4" />
                      </span>
                    )}
                  </div>
                ))}
                {editing && (
                  <button
                    type="button"
                    onClick={() => set("social_links", [...data.social_links, { icon: "globe", url: "" } as SiteSocialLink])}
                    className="inline-flex size-9 items-center justify-center rounded-full border border-dashed border-white/20 text-muted-foreground hover:border-primary/40 hover:text-primary"
                  >
                    <Plus className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">Services</h3>
              <ul className="mt-4 space-y-2.5">
                {data.services_links.map((service, i) => (
                  <li key={i} className="group flex items-center gap-2">
                    {editing ? (
                      <>
                        <EditableInput
                          value={service.label}
                          onChange={(v) => set("services_links", data.services_links.map((s, j) => (j === i ? { label: v } : s)))}
                          className="w-full text-sm text-muted-foreground"
                        />
                        <RemoveDot onClick={() => set("services_links", data.services_links.filter((_, j) => j !== i))} />
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">{service.label}</span>
                    )}
                  </li>
                ))}
              </ul>
              {editing && (
                <div className="mt-2">
                  <AddRow label="Ajouter" onClick={() => set("services_links", [...data.services_links, { label: "" } as SiteServiceLink])} />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">Navigation</h3>
              <ul className="mt-4 space-y-2.5">
                {NAV_LINKS.map((link) => (
                  <li key={link.label} className="text-sm text-muted-foreground/70">{link.label}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">Légal</h3>
              <ul className="mt-4 space-y-2.5">
                {data.legal_links.map((link, i) => (
                  <li key={i} className="group flex items-center gap-2">
                    {editing ? (
                      <>
                        <EditableInput
                          value={link.label}
                          onChange={(v) => set("legal_links", data.legal_links.map((l, j) => (j === i ? { ...l, label: v } : l)))}
                          className="w-full text-sm text-muted-foreground"
                        />
                        <RemoveDot onClick={() => set("legal_links", data.legal_links.filter((_, j) => j !== i))} />
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
              {editing && (
                <div className="mt-2">
                  <AddRow label="Ajouter" onClick={() => set("legal_links", [...data.legal_links, { label: "", href: "#" }])} />
                </div>
              )}
              <span className="mt-3 inline-block rounded-md border border-white/15 px-3 py-1.5 text-sm text-foreground/70">
                Suivre un projet
              </span>
            </div>
          </div>

          <div className="border-t border-white/10 px-6 py-4 sm:px-8">
            {editing ? (
              <EditableInput value={data.copyright_text} onChange={(v) => set("copyright_text", v)} className="w-full max-w-md text-xs text-muted-foreground" />
            ) : (
              <p className="text-xs text-muted-foreground">{data.copyright_text}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
