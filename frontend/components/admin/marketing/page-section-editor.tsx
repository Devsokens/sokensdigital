"use client";

import { useEffect, useState } from "react";
import {
  Diamond,
  Globe,
  LayoutGrid,
  Loader2,
  Mail,
  MonitorCog,
  Pencil,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalClose } from "@/components/ui/modal";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { listPageSections, updatePageSection, type PageSectionInput } from "@/lib/api/marketing";
import type { PageSection, SectionKey, SitePage } from "@/lib/api/types";

const ICONS: Record<string, LucideIcon> = { LayoutGrid, Globe, Smartphone, MonitorCog, Workflow, TrendingUp };

function initials(name: string) {
  return name.replace("Dr. ", "").split(" ").map((p) => p[0]).join("").slice(0, 2);
}

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
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">
        Reproduction fidèle de la page d&apos;accueil publique, section par section, dans l&apos;ordre réel d&apos;affichage —
        mêmes couleurs, mêmes icônes. Clique sur une section pour la modifier, comme si tu configurais un template.
      </p>

      {config.map((cfg) => {
        const section = sections.find((s) => s.section_key === cfg.key);
        if (!section) return null;
        return (
          <SectionPreview key={cfg.key} config={cfg} section={section} onEdit={() => setEditing(section)} />
        );
      })}

      <Modal open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <ModalContent title={editing ? `Modifier — ${config.find((c) => c.key === editing.section_key)?.label}` : ""}>
          {editing && (
            <SectionForm
              config={config.find((c) => c.key === editing.section_key)!}
              section={editing}
              onSaved={() => { setEditing(null); load(); }}
            />
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

/** Visually mirrors the real public component's markup/colors (same CSS
 * custom properties, defined once at :root — see app/globals.css — so
 * bg-background/bg-card/text-primary etc. render dark exactly like the
 * live site even though the surrounding admin UI is light-themed). No
 * framer-motion here — a static preview doesn't need scroll-triggered
 * animation, only visual fidelity. */
function SectionPreview({
  config, section, onEdit,
}: { config: SectionConfig; section: PageSection; onEdit: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{config.label}</span>
          {!section.is_active && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] text-muted-foreground">Masquée</span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-white/90"
        >
          <Pencil className="size-3" /> Modifier
        </button>
      </div>

      <div className="p-6 sm:p-8">
        <SectionPreviewBody sectionKey={section.section_key} section={section} />
      </div>
    </div>
  );
}

function SectionPreviewBody({ sectionKey, section }: { sectionKey: SectionKey; section: PageSection }) {
  switch (sectionKey) {
    case "hero": {
      const stats = section.items as { value: string; label: string }[];
      return (
        <div className="mx-auto max-w-2xl text-center">
          {section.kicker && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-[11px] font-medium tracking-[0.15em] text-primary uppercase">
              <Diamond className="size-2.5 fill-primary" /> {section.kicker}
            </div>
          )}
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{section.title}</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{section.subtitle}</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {section.cta_label && (
              <span className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
                {section.cta_label}
              </span>
            )}
            {section.cta_secondary_label && (
              <span className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-foreground">
                {section.cta_secondary_label} →
              </span>
            )}
          </div>
          {stats.length > 0 && (
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-1">
                  <span className="text-2xl font-bold text-primary">{stat.value}</span>
                  <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{stat.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    case "services": {
      const services = section.items as { icon: string; title: string; description: string }[];
      return (
        <div>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
              <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{section.subtitle}</p>
            </div>
            {section.cta_label && (
              <span className="shrink-0 text-sm font-medium text-primary">{section.cta_label} →</span>
            )}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const Icon = ICONS[s.icon] ?? LayoutGrid;
              return (
                <div key={s.title} className="rounded-2xl border border-white/10 bg-card/60 p-5">
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    case "recent_projects":
      return (
        <div>
          <span className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">{section.kicker}</span>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
          <p className="mt-3 text-xs text-muted-foreground italic">Carrousel piloté par le module Projets vitrine (à venir).</p>
        </div>
      );
    case "testimonials": {
      const testimonials = section.items as { quote: string; name: string; role: string }[];
      return (
        <div>
          <h2 className="text-center text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {testimonials.map((t) => (
              <figure key={t.name} className="rounded-2xl border border-white/10 bg-card/60 p-5">
                <blockquote className="text-xs leading-relaxed text-foreground/90">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(t.name)}
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-foreground">{t.name}</span>
                    <span className="block text-[0.7rem] text-muted-foreground">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      );
    }
    case "team": {
      const team = section.items as { name: string; role: string; bio: string }[];
      return (
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
          <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{section.subtitle}</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m) => (
              <div key={m.name} className="rounded-2xl border border-white/10 bg-card/60 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(m.name)}
                  </span>
                  <Mail className="size-3.5 text-muted-foreground" />
                </div>
                <h3 className="mt-3 text-sm font-semibold text-foreground">{m.name}</h3>
                <span className="text-[0.65rem] font-semibold tracking-[0.08em] text-primary uppercase">{m.role}</span>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{m.bio}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "partner_logos": {
      const partners = section.items as { name: string }[];
      return (
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-white/10 py-6">
          {partners.map((p) => (
            <span key={p.name} className="text-sm font-semibold tracking-[0.15em] text-muted-foreground/50 uppercase">
              {p.name}
            </span>
          ))}
        </div>
      );
    }
    case "blog_insights":
      return (
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
          {section.cta_label && <span className="text-sm font-medium text-primary">{section.cta_label} →</span>}
        </div>
      );
    case "cta":
      return (
        <div className="rounded-3xl border border-white/10 bg-card/60 px-8 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">{section.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{section.subtitle}</p>
          {section.cta_label && (
            <span className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
              {section.cta_label} →
            </span>
          )}
        </div>
      );
    default:
      return null;
  }
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

      {config.note && (
        <p className="flex items-start gap-1.5 text-xs text-neutral-400 italic">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" /> {config.note}
        </p>
      )}

      <div className="flex items-center justify-between pt-2">
        <ModalClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
