"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Diamond,
  Globe,
  LayoutGrid,
  Loader2,
  Mail,
  MonitorCog,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
  TrendingUp,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listPageSections, updatePageSection, type PageSectionInput } from "@/lib/api/marketing";
import type { PageSection, SectionKey, SitePage } from "@/lib/api/types";

const ICONS: Record<string, LucideIcon> = { LayoutGrid, Globe, Smartphone, MonitorCog, Workflow, TrendingUp };

function initials(name: string) {
  return name.replace("Dr. ", "").split(" ").map((p) => p[0]).join("").slice(0, 2);
}

const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Hero",
  services: "Services",
  recent_projects: "Projets récents",
  testimonials: "Témoignages",
  team: "Équipe",
  partner_logos: "Partenaires",
  blog_insights: "Aperçu blog",
  cta: "CTA final",
};

const SECTION_NOTES: Partial<Record<SectionKey, string>> = {
  recent_projects: "Le carrousel lui-même reste géré par le module Projets vitrine (à venir).",
  blog_insights: "Les articles affichés viennent automatiquement du Blog.",
};

const SECTION_ORDER: SectionKey[] = [
  "hero", "services", "recent_projects", "testimonials", "team", "partner_logos", "blog_insights", "cta",
];

export function PageSectionEditor({ page }: { page: SitePage }) {
  const [sections, setSections] = useState<PageSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        mêmes couleurs, mêmes icônes. Clique sur « Modifier » : la carte devient directement éditable.
      </p>

      {SECTION_ORDER.map((key) => {
        const section = sections.find((s) => s.section_key === key);
        if (!section) return null;
        return <SectionCard key={key} section={section} onSaved={load} />;
      })}
    </div>
  );
}

/* ---------- inline-editable primitives ---------- */

function EditableInput({
  value, onChange, className, placeholder,
}: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "rounded-md bg-white/[0.06] px-1.5 py-0.5 outline-none ring-1 ring-white/10 transition-colors",
        "placeholder:text-muted-foreground/40 focus:bg-white/10 focus:ring-primary/50",
        className
      )}
    />
  );
}

function EditableTextarea({
  value, onChange, className, placeholder, rows = 2,
}: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={cn(
        "w-full resize-none rounded-md bg-white/[0.06] px-1.5 py-1 outline-none ring-1 ring-white/10 transition-colors",
        "placeholder:text-muted-foreground/40 focus:bg-white/10 focus:ring-primary/50",
        className
      )}
    />
  );
}

/* ---------- card shell ---------- */

function SectionCard({ section, onSaved }: { section: PageSection; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<PageSectionInput>(() => toForm(section));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setForm(toForm(section));
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updatePageSection(section.id, form);
      setEditing(false);
      onSaved();
    } catch {
      setError("Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  }

  const items = form.items ?? [];
  function updateItem(index: number, key: string, value: string) {
    setForm((prev) => ({
      ...prev,
      items: (prev.items ?? []).map((it, i) => (i === index ? { ...it, [key]: value } : it)),
    }));
  }
  function addItem(blank: Record<string, string>) {
    setForm((prev) => ({ ...prev, items: [...(prev.items ?? []), blank] }));
  }
  function removeItem(index: number) {
    setForm((prev) => ({ ...prev, items: (prev.items ?? []).filter((_, i) => i !== index) }));
  }

  const data = editing ? form : toForm(section);
  const note = SECTION_NOTES[section.section_key];

  return (
    <div className={cn(
      "overflow-hidden rounded-2xl border bg-background shadow-sm transition-colors",
      editing ? "border-primary/40" : "border-white/10"
    )}>
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {SECTION_LABELS[section.section_key]}
          </span>
          {!editing && !section.is_active && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.65rem] text-muted-foreground">Masquée</span>
          )}
          {editing && (
            <label className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
              <input
                type="checkbox"
                checked={form.is_active ?? true}
                onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
              />
              Visible sur le site
            </label>
          )}
        </div>

        {editing ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={cancel}
              className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-foreground hover:bg-white/20"
            >
              <X className="size-3" /> Annuler
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-white/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Enregistrer
            </button>
          </div>
        ) : (
          <button
            onClick={startEditing}
            className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs text-neutral-700 hover:bg-white/90"
          >
            Modifier
          </button>
        )}
      </div>

      {error && (
        <p className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      <div className="p-6 sm:p-8">
        <SectionBody
          sectionKey={section.section_key}
          data={data}
          editing={editing}
          setForm={setForm}
          items={items}
          updateItem={updateItem}
          addItem={addItem}
          removeItem={removeItem}
        />
        {note && (
          <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground/70 italic">
            <Sparkles className="mt-0.5 size-3.5 shrink-0" /> {note}
          </p>
        )}
      </div>
    </div>
  );
}

function toForm(section: PageSection): PageSectionInput {
  return {
    is_active: section.is_active,
    kicker: section.kicker,
    title: section.title,
    subtitle: section.subtitle,
    cta_label: section.cta_label,
    cta_link: section.cta_link,
    cta_secondary_label: section.cta_secondary_label,
    cta_secondary_link: section.cta_secondary_link,
    items: section.items,
  };
}

/* ---------- per-section body (read + inline-edit in one) ---------- */

interface BodyProps {
  sectionKey: SectionKey;
  data: PageSectionInput;
  editing: boolean;
  setForm: React.Dispatch<React.SetStateAction<PageSectionInput>>;
  items: Record<string, unknown>[];
  updateItem: (index: number, key: string, value: string) => void;
  addItem: (blank: Record<string, string>) => void;
  removeItem: (index: number) => void;
}

function field(data: PageSectionInput, key: keyof PageSectionInput) {
  return (data[key] as string) ?? "";
}

function RemoveItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-1.5 right-1.5 rounded-full bg-black/40 p-1 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
    >
      <Trash2 className="size-3" />
    </button>
  );
}

function AddItemButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 p-5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
    >
      <Plus className="size-3.5" /> {label}
    </button>
  );
}

function SectionBody({ sectionKey, data, editing, setForm, items, updateItem, addItem, removeItem }: BodyProps) {
  switch (sectionKey) {
    case "hero": {
      const stats = items as { value: string; label: string }[];
      return (
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-[11px] font-medium tracking-[0.15em] text-primary uppercase">
            <Diamond className="size-2.5 fill-primary" />
            {editing ? (
              <EditableInput value={field(data, "kicker")} onChange={(v) => setForm((p) => ({ ...p, kicker: v }))} className="w-56 text-center" placeholder="Kicker" />
            ) : data.kicker}
          </div>
          {editing ? (
            <EditableInput value={field(data, "title")} onChange={(v) => setForm((p) => ({ ...p, title: v }))} className="w-full text-3xl font-semibold tracking-tight text-foreground sm:text-4xl" placeholder="Titre" />
          ) : (
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{data.title}</h1>
          )}
          {editing ? (
            <EditableTextarea value={field(data, "subtitle")} onChange={(v) => setForm((p) => ({ ...p, subtitle: v }))} className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground" placeholder="Sous-titre" />
          ) : (
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground">{data.subtitle}</p>
          )}
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <div className="flex flex-col items-center gap-1">
              <span className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
                {editing ? (
                  <EditableInput value={field(data, "cta_label")} onChange={(v) => setForm((p) => ({ ...p, cta_label: v }))} className="w-32 bg-white/10 text-center text-primary-foreground ring-primary-foreground/30" placeholder="Bouton" />
                ) : data.cta_label}
              </span>
              {editing && (
                <EditableInput value={field(data, "cta_link")} onChange={(v) => setForm((p) => ({ ...p, cta_link: v }))} className="w-40 text-center text-[0.65rem] text-muted-foreground" placeholder="/lien" />
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-foreground">
                {editing ? (
                  <EditableInput value={field(data, "cta_secondary_label")} onChange={(v) => setForm((p) => ({ ...p, cta_secondary_label: v }))} className="w-32 text-center" placeholder="Bouton secondaire" />
                ) : `${data.cta_secondary_label} →`}
              </span>
              {editing && (
                <EditableInput value={field(data, "cta_secondary_link")} onChange={(v) => setForm((p) => ({ ...p, cta_secondary_link: v }))} className="w-40 text-center text-[0.65rem] text-muted-foreground" placeholder="#lien" />
              )}
            </div>
          </div>
          {(stats.length > 0 || editing) && (
            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
              {stats.map((stat, index) => (
                <div key={index} className="group relative flex flex-col items-center gap-1">
                  {editing && <RemoveItemButton onClick={() => removeItem(index)} />}
                  {editing ? (
                    <EditableInput value={stat.value} onChange={(v) => updateItem(index, "value", v)} className="w-full text-center text-2xl font-bold text-primary" placeholder="150+" />
                  ) : (
                    <span className="text-2xl font-bold text-primary">{stat.value}</span>
                  )}
                  {editing ? (
                    <EditableInput value={stat.label} onChange={(v) => updateItem(index, "label", v)} className="w-full text-center text-[10px] tracking-[0.1em] text-muted-foreground uppercase" placeholder="Libellé" />
                  ) : (
                    <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{stat.label}</span>
                  )}
                </div>
              ))}
              {editing && stats.length < 3 && (
                <button onClick={() => addItem({ value: "", label: "" })} className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/15 py-2 text-muted-foreground hover:border-primary/40 hover:text-primary">
                  <Plus className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    case "services": {
      const services = items as { icon: string; title: string; description: string }[];
      return (
        <div>
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
            <div className="w-full">
              {editing ? (
                <EditableInput value={field(data, "title")} onChange={(v) => setForm((p) => ({ ...p, title: v }))} className="w-full text-xl font-semibold text-foreground" placeholder="Titre" />
              ) : (
                <h2 className="text-xl font-semibold tracking-tight text-foreground">{data.title}</h2>
              )}
              {editing ? (
                <EditableTextarea value={field(data, "subtitle")} onChange={(v) => setForm((p) => ({ ...p, subtitle: v }))} rows={2} className="mt-1.5 max-w-lg text-sm text-muted-foreground" placeholder="Sous-titre" />
              ) : (
                <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{data.subtitle}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {editing ? (
                <EditableInput value={field(data, "cta_label")} onChange={(v) => setForm((p) => ({ ...p, cta_label: v }))} className="w-44 text-right text-sm font-medium text-primary" placeholder="Lien CTA" />
              ) : (
                <span className="text-sm font-medium text-primary">{data.cta_label} →</span>
              )}
              {editing && (
                <EditableInput value={field(data, "cta_link")} onChange={(v) => setForm((p) => ({ ...p, cta_link: v }))} className="w-44 text-right text-[0.65rem] text-muted-foreground" placeholder="/lien" />
              )}
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, index) => {
              const Icon = ICONS[s.icon] ?? LayoutGrid;
              return (
                <div key={index} className="group relative rounded-2xl border border-white/10 bg-card/60 p-5">
                  {editing && <RemoveItemButton onClick={() => removeItem(index)} />}
                  <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                  {editing && (
                    <EditableInput value={s.icon} onChange={(v) => updateItem(index, "icon", v)} className="mb-2 block w-full text-[0.65rem] text-muted-foreground" placeholder="Nom icône (Globe...)" />
                  )}
                  {editing ? (
                    <EditableInput value={s.title} onChange={(v) => updateItem(index, "title", v)} className="w-full text-sm font-semibold text-foreground" placeholder="Titre" />
                  ) : (
                    <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                  )}
                  {editing ? (
                    <EditableTextarea value={s.description} onChange={(v) => updateItem(index, "description", v)} rows={3} className="mt-1.5 text-xs text-muted-foreground" placeholder="Description" />
                  ) : (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
                  )}
                </div>
              );
            })}
            {editing && <AddItemButton label="Ajouter un service" onClick={() => addItem({ icon: "LayoutGrid", title: "", description: "" })} />}
          </div>
        </div>
      );
    }

    case "recent_projects":
      return (
        <div>
          {editing ? (
            <EditableInput value={field(data, "kicker")} onChange={(v) => setForm((p) => ({ ...p, kicker: v }))} className="text-xs font-semibold tracking-[0.15em] text-primary uppercase" placeholder="Kicker" />
          ) : (
            <span className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">{data.kicker}</span>
          )}
          {editing ? (
            <EditableInput value={field(data, "title")} onChange={(v) => setForm((p) => ({ ...p, title: v }))} className="mt-1 block w-full text-xl font-semibold text-foreground" placeholder="Titre" />
          ) : (
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">{data.title}</h2>
          )}
        </div>
      );

    case "testimonials": {
      const testimonials = items as { quote: string; name: string; role: string }[];
      return (
        <div>
          {editing ? (
            <EditableInput value={field(data, "title")} onChange={(v) => setForm((p) => ({ ...p, title: v }))} className="mx-auto block w-full text-center text-xl font-semibold text-foreground" placeholder="Titre" />
          ) : (
            <h2 className="text-center text-xl font-semibold tracking-tight text-foreground">{data.title}</h2>
          )}
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {testimonials.map((t, index) => (
              <figure key={index} className="group relative rounded-2xl border border-white/10 bg-card/60 p-5">
                {editing && <RemoveItemButton onClick={() => removeItem(index)} />}
                {editing ? (
                  <EditableTextarea value={t.quote} onChange={(v) => updateItem(index, "quote", v)} rows={3} className="text-xs text-foreground/90" placeholder="Citation" />
                ) : (
                  <blockquote className="text-xs leading-relaxed text-foreground/90">&ldquo;{t.quote}&rdquo;</blockquote>
                )}
                <figcaption className="mt-4 flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(t.name || "?")}
                  </span>
                  <span className="flex-1">
                    {editing ? (
                      <EditableInput value={t.name} onChange={(v) => updateItem(index, "name", v)} className="block w-full text-xs font-semibold text-foreground" placeholder="Nom" />
                    ) : (
                      <span className="block text-xs font-semibold text-foreground">{t.name}</span>
                    )}
                    {editing ? (
                      <EditableInput value={t.role} onChange={(v) => updateItem(index, "role", v)} className="mt-0.5 block w-full text-[0.7rem] text-muted-foreground" placeholder="Fonction" />
                    ) : (
                      <span className="block text-[0.7rem] text-muted-foreground">{t.role}</span>
                    )}
                  </span>
                </figcaption>
              </figure>
            ))}
            {editing && <AddItemButton label="Ajouter un témoignage" onClick={() => addItem({ quote: "", name: "", role: "" })} />}
          </div>
        </div>
      );
    }

    case "team": {
      const team = items as { name: string; role: string; bio: string }[];
      return (
        <div>
          {editing ? (
            <EditableInput value={field(data, "title")} onChange={(v) => setForm((p) => ({ ...p, title: v }))} className="w-full text-xl font-semibold text-foreground" placeholder="Titre" />
          ) : (
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{data.title}</h2>
          )}
          {editing ? (
            <EditableTextarea value={field(data, "subtitle")} onChange={(v) => setForm((p) => ({ ...p, subtitle: v }))} rows={2} className="mt-1.5 max-w-lg text-sm text-muted-foreground" placeholder="Sous-titre" />
          ) : (
            <p className="mt-1.5 max-w-lg text-sm text-muted-foreground">{data.subtitle}</p>
          )}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {team.map((m, index) => (
              <div key={index} className="group relative rounded-2xl border border-white/10 bg-card/60 p-5">
                {editing && <RemoveItemButton onClick={() => removeItem(index)} />}
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {initials(m.name || "?")}
                  </span>
                  <Mail className="size-3.5 text-muted-foreground" />
                </div>
                {editing ? (
                  <EditableInput value={m.name} onChange={(v) => updateItem(index, "name", v)} className="mt-3 block w-full text-sm font-semibold text-foreground" placeholder="Nom" />
                ) : (
                  <h3 className="mt-3 text-sm font-semibold text-foreground">{m.name}</h3>
                )}
                {editing ? (
                  <EditableInput value={m.role} onChange={(v) => updateItem(index, "role", v)} className="mt-1 block w-full text-[0.65rem] font-semibold tracking-[0.08em] text-primary uppercase" placeholder="Poste" />
                ) : (
                  <span className="text-[0.65rem] font-semibold tracking-[0.08em] text-primary uppercase">{m.role}</span>
                )}
                {editing ? (
                  <EditableTextarea value={m.bio} onChange={(v) => updateItem(index, "bio", v)} rows={2} className="mt-1.5 text-xs text-muted-foreground" placeholder="Bio" />
                ) : (
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{m.bio}</p>
                )}
              </div>
            ))}
            {editing && <AddItemButton label="Ajouter un membre" onClick={() => addItem({ name: "", role: "", bio: "" })} />}
          </div>
        </div>
      );
    }

    case "partner_logos": {
      const partners = items as { name: string }[];
      return (
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-white/10 py-6">
          {partners.map((p, index) => (
            <span key={index} className="group relative">
              {editing && <RemoveItemButton onClick={() => removeItem(index)} />}
              {editing ? (
                <EditableInput value={p.name} onChange={(v) => updateItem(index, "name", v)} className="text-center text-sm font-semibold tracking-[0.15em] text-muted-foreground/70 uppercase" placeholder="Nom" />
              ) : (
                <span className="text-sm font-semibold tracking-[0.15em] text-muted-foreground/50 uppercase">{p.name}</span>
              )}
            </span>
          ))}
          {editing && (
            <button onClick={() => addItem({ name: "" })} className="flex items-center gap-1 rounded-full border border-dashed border-white/15 px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary">
              <Plus className="size-3" /> Ajouter
            </button>
          )}
        </div>
      );
    }

    case "blog_insights":
      return (
        <div className="flex items-end justify-between gap-4">
          {editing ? (
            <EditableInput value={field(data, "title")} onChange={(v) => setForm((p) => ({ ...p, title: v }))} className="w-full text-xl font-semibold text-foreground" placeholder="Titre" />
          ) : (
            <h2 className="text-xl font-semibold tracking-tight text-foreground">{data.title}</h2>
          )}
          <div className="flex shrink-0 flex-col items-end gap-1">
            {editing ? (
              <EditableInput value={field(data, "cta_label")} onChange={(v) => setForm((p) => ({ ...p, cta_label: v }))} className="w-36 text-right text-sm font-medium text-primary" placeholder="Lien CTA" />
            ) : (
              <span className="text-sm font-medium text-primary">{data.cta_label} →</span>
            )}
            {editing && (
              <EditableInput value={field(data, "cta_link")} onChange={(v) => setForm((p) => ({ ...p, cta_link: v }))} className="w-36 text-right text-[0.65rem] text-muted-foreground" placeholder="/lien" />
            )}
          </div>
        </div>
      );

    case "cta":
      return (
        <div className="rounded-3xl border border-white/10 bg-card/60 px-8 py-12 text-center">
          {editing ? (
            <EditableInput value={field(data, "title")} onChange={(v) => setForm((p) => ({ ...p, title: v }))} className="mx-auto block w-full text-center text-2xl font-semibold text-foreground" placeholder="Titre" />
          ) : (
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">{data.title}</h2>
          )}
          {editing ? (
            <EditableTextarea value={field(data, "subtitle")} onChange={(v) => setForm((p) => ({ ...p, subtitle: v }))} rows={2} className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground" placeholder="Sous-titre" />
          ) : (
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{data.subtitle}</p>
          )}
          <div className="mt-6 flex flex-col items-center gap-1">
            <span className="inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
              {editing ? (
                <EditableInput value={field(data, "cta_label")} onChange={(v) => setForm((p) => ({ ...p, cta_label: v }))} className="w-32 bg-white/10 text-center text-primary-foreground ring-primary-foreground/30" placeholder="Bouton" />
              ) : `${data.cta_label} →`}
            </span>
            {editing && (
              <EditableInput value={field(data, "cta_link")} onChange={(v) => setForm((p) => ({ ...p, cta_link: v }))} className="w-40 text-center text-[0.65rem] text-muted-foreground" placeholder="/lien" />
            )}
          </div>
        </div>
      );

    default:
      return null;
  }
}
