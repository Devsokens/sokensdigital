"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { cardClass, inputClass, labelClass } from "@/components/admin/form-styles";
import { listPageSections, updatePageSection, type PageSectionInput } from "@/lib/api/marketing";
import type { PageSection, SectionKey, SitePage } from "@/lib/api/types";

interface ItemFieldDef {
  key: string;
  label: string;
  type: "text" | "textarea";
}

interface SectionConfig {
  key: SectionKey;
  label: string;
  note?: string;
  kicker?: boolean;
  title?: boolean;
  subtitle?: boolean;
  cta?: boolean;
  ctaSecondary?: boolean;
  itemLabel?: string;
  itemFields?: ItemFieldDef[];
}

const ACCUEIL_CONFIG: SectionConfig[] = [
  {
    key: "hero", label: "Hero", title: true, subtitle: true, kicker: true, cta: true, ctaSecondary: true,
    itemLabel: "Statistique",
    itemFields: [
      { key: "value", label: "Valeur (ex: 150+)", type: "text" },
      { key: "label", label: "Libellé (ex: Projets livrés)", type: "text" },
    ],
  },
  {
    key: "services", label: "Services", title: true, subtitle: true, cta: true,
    itemLabel: "Service",
    itemFields: [
      { key: "icon", label: "Icône (nom Lucide, ex: Globe)", type: "text" },
      { key: "title", label: "Titre", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  {
    key: "recent_projects", label: "Projets récents", title: true, kicker: true,
    note: "Le carrousel lui-même reste géré par le module Projets vitrine (à venir) — seuls le kicker et le titre sont éditables ici.",
  },
  {
    key: "testimonials", label: "Témoignages", title: true,
    itemLabel: "Témoignage",
    itemFields: [
      { key: "quote", label: "Citation", type: "textarea" },
      { key: "name", label: "Nom", type: "text" },
      { key: "role", label: "Fonction", type: "text" },
    ],
  },
  {
    key: "team", label: "Équipe", title: true, subtitle: true,
    itemLabel: "Membre",
    itemFields: [
      { key: "name", label: "Nom", type: "text" },
      { key: "role", label: "Poste", type: "text" },
      { key: "bio", label: "Bio", type: "textarea" },
    ],
  },
  {
    key: "partner_logos", label: "Partenaires",
    itemLabel: "Partenaire",
    itemFields: [{ key: "name", label: "Nom", type: "text" }],
  },
  {
    key: "blog_insights", label: "Aperçu blog", title: true, cta: true,
    note: "Les articles affichés viennent automatiquement du Blog — seuls le titre et le lien sont éditables ici.",
  },
  {
    key: "cta", label: "CTA final", title: true, subtitle: true, cta: true,
  },
];

export function PageSectionEditor({ page }: { page: SitePage }) {
  const [sections, setSections] = useState<PageSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PageSection | null>(null);

  const config = ACCUEIL_CONFIG;

  async function load() {
    try {
      const data = await listPageSections(page);
      setSections(data);
    } catch {
      setError("Impossible de charger les sections de la page.");
    }
  }

  useEffect(() => {
    load();
  }, [page]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!sections) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        Reproduction fidèle de la page d&apos;accueil publique, section par section, dans l&apos;ordre réel d&apos;affichage.
        Clique sur une section pour la modifier — comme si tu configurais un template.
      </p>

      {config.map((cfg) => {
        const section = sections.find((s) => s.section_key === cfg.key);
        if (!section) return null;
        return (
          <SectionPreviewCard
            key={cfg.key}
            config={cfg}
            section={section}
            onEdit={() => setEditing(section)}
          />
        );
      })}

      <Sheet open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <SheetContent title={editing ? `Modifier — ${config.find((c) => c.key === editing.section_key)?.label}` : ""}>
          {editing && (
            <SectionForm
              config={config.find((c) => c.key === editing.section_key)!}
              section={editing}
              onSaved={() => { setEditing(null); load(); }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function SectionPreviewCard({
  config, section, onEdit,
}: { config: SectionConfig; section: PageSection; onEdit: () => void }) {
  return (
    <div className={cardClass}>
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <span className="text-[0.65rem] font-semibold tracking-wider text-neutral-400 uppercase">{config.label}</span>
          {!section.is_active && (
            <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-[0.65rem] text-neutral-500">Masquée</span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-200"
        >
          <Pencil className="size-3" /> Modifier
        </button>
      </div>

      {config.kicker && section.kicker && (
        <p className="mb-1 text-xs font-medium text-primary">{section.kicker}</p>
      )}
      {config.title && section.title && (
        <p className="text-lg font-semibold text-neutral-900">{section.title}</p>
      )}
      {config.subtitle && section.subtitle && (
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">{section.subtitle}</p>
      )}
      {config.cta && section.cta_label && (
        <p className="mt-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {section.cta_label}
        </p>
      )}

      {config.itemFields && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.length === 0 && (
            <p className="text-xs text-neutral-400">Aucun élément pour l&apos;instant.</p>
          )}
          {section.items.map((item, index) => (
            <div key={index} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
              {config.itemFields!.map((field) => (
                <p key={field.key} className="truncate">
                  <span className="text-neutral-400">{field.label.split(" (")[0]}: </span>
                  {String(item[field.key] ?? "—")}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {config.note && <p className="mt-3 text-xs text-neutral-400 italic">{config.note}</p>}
    </div>
  );
}

function SectionForm({
  config, section, onSaved,
}: { config: SectionConfig; section: PageSection; onSaved: () => void }) {
  const [form, setForm] = useState<PageSectionInput>({
    is_active: section.is_active,
    kicker: section.kicker,
    title: section.title,
    subtitle: section.subtitle,
    cta_label: section.cta_label,
    cta_link: section.cta_link,
    cta_secondary_label: section.cta_secondary_label,
    cta_secondary_link: section.cta_secondary_link,
    items: section.items,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const items = form.items ?? [];

  function updateItem(index: number, key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      items: (prev.items ?? []).map((item, i) => (i === index ? { ...item, [key]: value } : item)),
    }));
  }

  function addItem() {
    const blank: Record<string, string> = {};
    config.itemFields?.forEach((f) => { blank[f.key] = ""; });
    setForm((prev) => ({ ...prev, items: [...(prev.items ?? []), blank] }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({ ...prev, items: (prev.items ?? []).filter((_, i) => i !== index) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updatePageSection(section.id, form);
      onSaved();
    } catch {
      setError("Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">{error}</p>
      )}

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.is_active ?? true}
          onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
        />
        <span className={labelClass}>Section visible sur le site public</span>
      </label>

      {config.kicker && (
        <label className="block">
          <span className={labelClass}>Kicker (badge au-dessus du titre)</span>
          <input value={form.kicker ?? ""} onChange={(e) => setForm((p) => ({ ...p, kicker: e.target.value }))} className={inputClass} />
        </label>
      )}
      {config.title && (
        <label className="block">
          <span className={labelClass}>Titre</span>
          <input value={form.title ?? ""} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className={inputClass} />
        </label>
      )}
      {config.subtitle && (
        <label className="block">
          <span className={labelClass}>Sous-titre</span>
          <textarea value={form.subtitle ?? ""} onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))} className={`${inputClass} min-h-20`} />
        </label>
      )}
      {config.cta && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Bouton — libellé</span>
            <input value={form.cta_label ?? ""} onChange={(e) => setForm((p) => ({ ...p, cta_label: e.target.value }))} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Bouton — lien</span>
            <input value={form.cta_link ?? ""} onChange={(e) => setForm((p) => ({ ...p, cta_link: e.target.value }))} className={inputClass} />
          </label>
        </div>
      )}
      {config.ctaSecondary && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Bouton secondaire — libellé</span>
            <input value={form.cta_secondary_label ?? ""} onChange={(e) => setForm((p) => ({ ...p, cta_secondary_label: e.target.value }))} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Bouton secondaire — lien</span>
            <input value={form.cta_secondary_link ?? ""} onChange={(e) => setForm((p) => ({ ...p, cta_secondary_link: e.target.value }))} className={inputClass} />
          </label>
        </div>
      )}

      {config.itemFields && (
        <div className="space-y-3">
          <span className={labelClass}>{config.itemLabel}s</span>
          {items.map((item, index) => (
            <div key={index} className="space-y-2 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500">{config.itemLabel} {index + 1}</span>
                <button type="button" onClick={() => removeItem(index)} className="text-neutral-400 hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              {config.itemFields!.map((field) => (
                <label key={field.key} className="block">
                  <span className={labelClass}>{field.label}</span>
                  {field.type === "textarea" ? (
                    <textarea
                      value={String(item[field.key] ?? "")}
                      onChange={(e) => updateItem(index, field.key, e.target.value)}
                      className={`${inputClass} min-h-16`}
                    />
                  ) : (
                    <input
                      value={String(item[field.key] ?? "")}
                      onChange={(e) => updateItem(index, field.key, e.target.value)}
                      className={inputClass}
                    />
                  )}
                </label>
              ))}
            </div>
          ))}
          <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Plus className="size-3.5" /> Ajouter {config.itemLabel?.toLowerCase()}
          </button>
        </div>
      )}

      {config.note && <p className="text-xs text-neutral-400 italic">{config.note}</p>}

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
