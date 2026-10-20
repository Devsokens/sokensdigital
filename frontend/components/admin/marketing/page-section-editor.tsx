"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listPageSections, updatePageSection, type PageSectionInput } from "@/lib/api/marketing";
import { uploadImage } from "@/lib/api/upload";
import type { PageSection, SectionKey } from "@/lib/api/types";
import { IconPicker, SectionIcon } from "@/components/admin/marketing/icon-picker";

/* Éditeur par formulaires des pages qui n'ont pas été refondues (Démarrer un
 * projet, Suivi de projet). Les pages vitrine (Accueil, Expertise, Projets,
 * Blog, Contact) s'éditent dans l'éditeur visuel : vitrine-editor.tsx. */

type FormPage = "SUIVI_PROJET" | "DEMARRER_PROJET";

const SECTION_LABELS: Partial<Record<SectionKey, string>> = {
  tracking_hero: "Hero",
  tracking_features: "Fonctionnalités mises en avant",
  start_project_objectifs: "Objectif du projet",
  start_project_solutions: "Type de solution",
  start_project_delais: "Délai souhaité",
  start_project_canaux: "Canal de communication",
};

const SECTION_NOTES: Partial<Record<SectionKey, string>> = {
  tracking_hero: "Le formulaire de recherche de référence n'est pas éditable ici.",
};

const PAGE_SECTION_ORDER: Record<FormPage, SectionKey[]> = {
  SUIVI_PROJET: ["tracking_hero", "tracking_features"],
  DEMARRER_PROJET: ["start_project_objectifs", "start_project_solutions", "start_project_delais", "start_project_canaux"],
};

const PAGE_DESCRIPTIONS: Record<FormPage, string> = {
  SUIVI_PROJET: "page Suivi de projet",
  DEMARRER_PROJET: "page Démarrer un projet",
};

export function PageSectionEditor({ page }: { page: FormPage }) {
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
    listPageSections(page)
      .then(setSections)
      .catch(() => setError("Impossible de charger les sections de la page."));
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
        Reproduction fidèle de la {PAGE_DESCRIPTIONS[page]} publique, section par section, dans l&apos;ordre réel d&apos;affichage —
        mêmes couleurs, mêmes icônes. Clique sur « Modifier » : la carte devient directement éditable.
      </p>

      {PAGE_SECTION_ORDER[page].map((key) => {
        const section = sections.find((s) => s.section_key === key);
        if (!section) return null;
        return <SectionCard key={key} section={section} onSaved={load} />;
      })}
    </div>
  );
}

/* ---------- inline-editable primitives ---------- */

export function EditableInput({
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

export function EditableTextarea({
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

export function ImageUploadField({
  value, onChange, shape = "square",
}: { value: string; onChange: (url: string) => void; shape?: "square" | "circle" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        title="Changer l'image"
        className={cn(
          "group relative flex size-12 shrink-0 items-center justify-center overflow-hidden border border-dashed border-white/20 bg-white/5 text-muted-foreground transition-colors hover:border-primary/40",
          shape === "circle" ? "rounded-full" : "rounded-lg"
        )}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <ImagePlus className="size-4" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <ImagePlus className="size-3.5 text-white" />
        </span>
      </button>
      <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif" onChange={handleFile} className="hidden" />
      {error && <p className="max-w-20 text-center text-[0.6rem] leading-tight text-destructive">{error}</p>}
    </div>
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
    setForm((prev) => {
      const current = prev.items ?? [];
      // Pad with blank entries if writing past the end — needed for
      // fixed single-item "panels" (e.g. expertise_hero) that may not
      // have a seeded row yet.
      const padded = current.length > index ? current : [...current, ...Array(index + 1 - current.length).fill({})];
      return { ...prev, items: padded.map((it, i) => (i === index ? { ...it, [key]: value } : it)) };
    });
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

export function RemoveItemButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-1.5 right-1.5 rounded-full bg-black/40 p-1 text-white/70 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
    >
      <Trash2 className="size-3" />
    </button>
  );
}

export function AddItemButton({ onClick, label }: { onClick: () => void; label: string }) {
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
    case "tracking_hero":
      return (
        <div className="mx-auto max-w-xl text-center">
          {editing ? (
            <EditableInput value={field(data, "title")} onChange={(v) => setForm((p) => ({ ...p, title: v }))} className="w-full text-center text-3xl font-semibold text-foreground" placeholder="Titre" />
          ) : (
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{data.title}</h1>
          )}
          {editing ? (
            <EditableTextarea value={field(data, "subtitle")} onChange={(v) => setForm((p) => ({ ...p, subtitle: v }))} className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground" placeholder="Sous-titre" />
          ) : (
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{data.subtitle}</p>
          )}
        </div>
      );

    case "tracking_features": {
      const features = items as { icon: string; title: string; description: string }[];
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {features.map((f, index) => (
            <div key={index} className="group relative rounded-2xl border border-white/10 bg-card/60 p-5">
              {editing && <RemoveItemButton onClick={() => removeItem(index)} />}
              <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <SectionIcon name={f.icon} className="size-4.5" />
              </div>
              {editing && (
                <div className="mb-2">
                  <IconPicker value={f.icon} onChange={(v) => updateItem(index, "icon", v)} />
                </div>
              )}
              {editing ? (
                <EditableInput value={f.title} onChange={(v) => updateItem(index, "title", v)} className="w-full text-sm font-semibold text-foreground" placeholder="Titre" />
              ) : (
                <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
              )}
              {editing ? (
                <EditableTextarea value={f.description} onChange={(v) => updateItem(index, "description", v)} rows={3} className="mt-1.5 text-xs text-muted-foreground" placeholder="Description" />
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.description}</p>
              )}
            </div>
          ))}
          {editing && <AddItemButton label="Ajouter une fonctionnalité" onClick={() => addItem({ icon: "shield", title: "", description: "" })} />}
        </div>
      );
    }

    case "start_project_objectifs": {
      const objectifs = items as { icon: string; title: string; description: string }[];
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {objectifs.map((o, index) => (
            <div key={index} className="group relative rounded-xl border border-white/10 bg-card/60 p-4">
              {editing && <RemoveItemButton onClick={() => removeItem(index)} />}
              <SectionIcon name={o.icon} className="size-5 text-foreground/80" />
              {editing && (
                <div className="mt-2">
                  <IconPicker value={o.icon} onChange={(v) => updateItem(index, "icon", v)} />
                </div>
              )}
              {editing ? (
                <EditableInput value={o.title} onChange={(v) => updateItem(index, "title", v)} className="mt-3 block w-full text-sm font-semibold text-foreground" placeholder="Titre" />
              ) : (
                <h4 className="mt-3 text-sm font-semibold text-foreground">{o.title}</h4>
              )}
              {editing ? (
                <EditableTextarea value={o.description} onChange={(v) => updateItem(index, "description", v)} rows={2} className="mt-1.5 text-xs text-muted-foreground" placeholder="Description" />
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{o.description}</p>
              )}
            </div>
          ))}
          {editing && <AddItemButton label="Ajouter un objectif" onClick={() => addItem({ icon: "rocket", title: "", description: "" })} />}
        </div>
      );
    }

    case "start_project_solutions": {
      const solutions = items as { label: string }[];
      return (
        <div className="flex flex-wrap gap-2">
          {solutions.map((s, index) => (
            <div key={index} className="group relative">
              {editing ? (
                <div className="flex items-center gap-1 rounded-full bg-white/[0.06] py-1 pr-1 pl-3 ring-1 ring-white/10">
                  <EditableInput value={s.label} onChange={(v) => updateItem(index, "label", v)} className="w-32 text-xs text-foreground" />
                  <RemoveItemButton onClick={() => removeItem(index)} />
                </div>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-foreground">{s.label}</span>
              )}
            </div>
          ))}
          {editing && <AddItemButton label="Ajouter" onClick={() => addItem({ label: "" })} />}
        </div>
      );
    }

    case "start_project_delais": {
      const delais = items as { title: string; subtitle: string }[];
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {delais.map((d, index) => (
            <div key={index} className="group relative rounded-xl border border-white/10 bg-card/60 p-4">
              {editing && <RemoveItemButton onClick={() => removeItem(index)} />}
              {editing ? (
                <EditableInput value={d.title} onChange={(v) => updateItem(index, "title", v)} className="block w-full text-sm font-semibold text-foreground" placeholder="Titre" />
              ) : (
                <h4 className="text-sm font-semibold text-foreground">{d.title}</h4>
              )}
              {editing ? (
                <EditableInput value={d.subtitle} onChange={(v) => updateItem(index, "subtitle", v)} className="mt-1 block w-full text-xs text-muted-foreground" placeholder="Sous-titre" />
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{d.subtitle}</p>
              )}
            </div>
          ))}
          {editing && <AddItemButton label="Ajouter un délai" onClick={() => addItem({ title: "", subtitle: "" })} />}
        </div>
      );
    }

    case "start_project_canaux": {
      const canaux = items as { icon: string; label: string }[];
      return (
        <div className="flex flex-wrap gap-2">
          {canaux.map((c, index) => (
            <div key={index} className="group relative">
              {editing ? (
                <div className="flex items-center gap-1 rounded-full bg-white/[0.06] py-1 pr-1 pl-2 ring-1 ring-white/10">
                  <IconPicker value={c.icon} onChange={(v) => updateItem(index, "icon", v)} />
                  <EditableInput value={c.label} onChange={(v) => updateItem(index, "label", v)} className="w-24 text-xs text-foreground" />
                  <RemoveItemButton onClick={() => removeItem(index)} />
                </div>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-foreground">
                  <SectionIcon name={c.icon} className="size-3.5" /> {c.label}
                </span>
              )}
            </div>
          ))}
          {editing && <AddItemButton label="Ajouter" onClick={() => addItem({ icon: "mail", label: "" })} />}
        </div>
      );
    }

    default:
      return null;
  }
}
