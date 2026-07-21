"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { ImageUploadField } from "@/components/admin/marketing/page-section-editor";
import {
  listShowcaseProjects,
  createShowcaseProject,
  updateShowcaseProject,
  deleteShowcaseProject,
  type ShowcaseProjectInput,
} from "@/lib/api/marketing";
import type { ShowcaseProject } from "@/lib/api/types";

const SCENE_VARIANTS = ["chart", "network", "map", "code", "security", "medical"] as const;

const EMPTY: ShowcaseProjectInput = {
  category: "",
  sector: "",
  type: "",
  featured: false,
  show_on_homepage: false,
  order: 0,
  is_active: true,
  status_tag: "",
  tag: "",
  title: "",
  description: "",
  visual_icon: "",
  video_src: "",
  images: [],
  scene_variants: [],
  client: "",
  technologies: [],
  timeline: "",
  lead_name: "",
  lead_role: "",
  challenge: "",
  stats: [],
  solution: "",
  solution_points: [],
};

export function ShowcaseProjectList() {
  const [projects, setProjects] = useState<ShowcaseProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShowcaseProject | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const data = await listShowcaseProjects();
      setProjects(data.results);
    } catch {
      setError("Impossible de charger les projets.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(project: ShowcaseProject) {
    if (!confirm(`Supprimer "${project.title}" ?`)) return;
    try {
      await deleteShowcaseProject(project.id!);
      load();
    } catch {
      setError(`Impossible de supprimer "${project.title}".`);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!projects) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Projets vitrine</h1>
          <p className="text-sm text-neutral-500">
            Les études de cas de la grille /projects et de la fiche détaillée /projects/[slug].
          </p>
        </div>
        <Sheet
          open={open && !editing}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setEditing(null);
          }}
        >
          <SheetTrigger
            render={
              <Button className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Nouveau projet
              </Button>
            }
          />
          <SheetContent title="Nouveau projet" className="max-w-2xl">
            <ShowcaseProjectForm
              onSaved={() => {
                setOpen(false);
                load();
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Titre</th>
              <th className="px-4 py-3 font-medium">Secteur</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {projects.map((project) => (
              <tr key={project.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Sheet
                    open={open && editing?.id === project.id}
                    onOpenChange={(next) => {
                      setOpen(next);
                      setEditing(next ? project : null);
                    }}
                  >
                    <SheetTrigger
                      render={
                        <button type="button" className="text-neutral-900 hover:text-primary">
                          {project.title}
                        </button>
                      }
                    />
                    <SheetContent title="Modifier le projet" className="max-w-2xl">
                      <ShowcaseProjectForm
                        project={project}
                        onSaved={() => {
                          setOpen(false);
                          setEditing(null);
                          load();
                        }}
                      />
                    </SheetContent>
                  </Sheet>
                </td>
                <td className="px-4 py-3 text-neutral-500">{project.sector}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      project.is_active
                        ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500"
                    }
                  >
                    {project.is_active ? "Actif" : "Inactif"}
                  </span>
                  {project.show_on_homepage && (
                    <span className="ml-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                      Accueil
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(project)}
                    aria-label="Supprimer"
                    className="text-neutral-400 hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  Aucun projet pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function toInput(project: ShowcaseProject): ShowcaseProjectInput {
  return {
    category: project.category,
    sector: project.sector,
    type: project.type,
    featured: project.featured,
    show_on_homepage: project.show_on_homepage ?? false,
    order: project.order ?? 0,
    is_active: project.is_active ?? true,
    status_tag: project.status_tag,
    tag: project.tag,
    title: project.title,
    description: project.description,
    visual_icon: project.visual_icon,
    video_src: project.video_src,
    images: project.images,
    scene_variants: project.scene_variants,
    client: project.client,
    technologies: project.technologies,
    timeline: project.timeline,
    lead_name: project.lead_name,
    lead_role: project.lead_role,
    challenge: project.challenge,
    stats: project.stats,
    solution: project.solution,
    solution_points: project.solution_points,
  };
}

function ShowcaseProjectForm({ project, onSaved }: { project?: ShowcaseProject; onSaved: () => void }) {
  const [form, setForm] = useState<ShowcaseProjectInput>(project ? toInput(project) : EMPTY);
  const [technologiesText, setTechnologiesText] = useState(project?.technologies.join(", ") ?? "");
  const [solutionPointsText, setSolutionPointsText] = useState(project?.solution_points.join("\n") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ShowcaseProjectInput>(key: K, value: ShowcaseProjectInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleSceneVariant(variant: string) {
    const current = form.scene_variants ?? [];
    set("scene_variants", current.includes(variant) ? current.filter((v) => v !== variant) : [...current, variant]);
  }

  function addStat() {
    set("stats", [...(form.stats ?? []), { value: "", label: "" }]);
  }
  function updateStat(index: number, key: "value" | "label", value: string) {
    set("stats", (form.stats ?? []).map((s, i) => (i === index ? { ...s, [key]: value } : s)));
  }
  function removeStat(index: number) {
    set("stats", (form.stats ?? []).filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: ShowcaseProjectInput = {
      ...form,
      technologies: technologiesText.split(",").map((t) => t.trim()).filter(Boolean),
      solution_points: solutionPointsText.split("\n").map((p) => p.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (project) {
        await updateShowcaseProject(project.id!, payload);
      } else {
        await createShowcaseProject(payload);
      }
      onSaved();
    } catch {
      setError("Impossible d'enregistrer le projet.");
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

      {project?.slug && (
        <p className="text-[0.7rem] text-neutral-400">Slug : {project.slug}</p>
      )}

      <label className="block">
        <span className={labelClass}>Titre</span>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} required />
      </label>

      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} className={`${inputClass} min-h-16`} />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className={labelClass}>Catégorie</span>
          <input value={form.category} onChange={(e) => set("category", e.target.value)} className={inputClass} placeholder="FINTECH" required />
        </label>
        <label className="block">
          <span className={labelClass}>Secteur</span>
          <input value={form.sector} onChange={(e) => set("sector", e.target.value)} className={inputClass} placeholder="Fintech" required />
        </label>
        <label className="block">
          <span className={labelClass}>Type</span>
          <input value={form.type} onChange={(e) => set("type", e.target.value)} className={inputClass} placeholder="Web App" required />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Tag (affiché sur la fiche)</span>
          <input value={form.tag ?? ""} onChange={(e) => set("tag", e.target.value)} className={inputClass} placeholder="FINTECH · SÉCURITÉ" />
        </label>
        <label className="block">
          <span className={labelClass}>Statut / date</span>
          <input value={form.status_tag ?? ""} onChange={(e) => set("status_tag", e.target.value)} className={inputClass} placeholder="2024 · Déploiement" />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Icône (lucide-react)</span>
        <input value={form.visual_icon ?? ""} onChange={(e) => set("visual_icon", e.target.value)} className={inputClass} placeholder="shield-check" />
      </label>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-neutral-200 px-3.5 py-2.5">
        <label className="flex items-center gap-1.5 text-sm text-neutral-700">
          <input type="checkbox" checked={form.featured ?? false} onChange={(e) => set("featured", e.target.checked)} />
          Featured (grille /projects)
        </label>
        <label className="flex items-center gap-1.5 text-sm text-neutral-700">
          <input type="checkbox" checked={form.show_on_homepage ?? false} onChange={(e) => set("show_on_homepage", e.target.checked)} />
          Afficher sur l&apos;accueil
        </label>
        <label className="flex items-center gap-1.5 text-sm text-neutral-700">
          <input type="checkbox" checked={form.is_active ?? true} onChange={(e) => set("is_active", e.target.checked)} />
          Actif (visible publiquement)
        </label>
        <label className="ml-auto flex items-center gap-1.5 text-sm text-neutral-700">
          Ordre
          <input
            type="number"
            value={form.order ?? 0}
            onChange={(e) => set("order", Number(e.target.value))}
            className="w-16 rounded-md border border-neutral-200 px-2 py-1 text-sm"
          />
        </label>
      </div>

      <div>
        <span className={labelClass}>Images</span>
        <div className="flex flex-wrap items-center gap-2">
          {(form.images ?? []).map((url, i) => (
            <div key={i} className="group relative size-14 shrink-0 overflow-hidden rounded-lg border border-neutral-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => set("images", (form.images ?? []).filter((_, j) => j !== i))}
                className="absolute inset-0 flex items-center justify-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <ImageUploadField value="" onChange={(url) => set("images", [...(form.images ?? []), url])} />
        </div>
        <p className="mt-1 text-[0.7rem] text-neutral-400">
          Plusieurs images s&apos;enchaînent automatiquement sur la fiche projet.
        </p>
      </div>

      <label className="block">
        <span className={labelClass}>Vidéo (URL, prioritaire sur les images)</span>
        <input value={form.video_src ?? ""} onChange={(e) => set("video_src", e.target.value)} className={inputClass} placeholder="https://…" />
      </label>

      <div>
        <span className={labelClass}>Scènes animées (tant qu&apos;aucune image/vidéo réelle)</span>
        <div className="flex flex-wrap gap-1.5">
          {SCENE_VARIANTS.map((variant) => (
            <button
              key={variant}
              type="button"
              onClick={() => toggleSceneVariant(variant)}
              className={
                (form.scene_variants ?? []).includes(variant)
                  ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
                  : "rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-500"
              }
            >
              {variant}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className={labelClass}>Client</span>
          <input value={form.client ?? ""} onChange={(e) => set("client", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Durée</span>
          <input value={form.timeline ?? ""} onChange={(e) => set("timeline", e.target.value)} className={inputClass} placeholder="6 Mois" />
        </label>
        <label className="block" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Responsable (nom)</span>
          <input value={form.lead_name ?? ""} onChange={(e) => set("lead_name", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Responsable (rôle)</span>
          <input value={form.lead_role ?? ""} onChange={(e) => set("lead_role", e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Technologies (séparées par des virgules)</span>
        <input value={technologiesText} onChange={(e) => setTechnologiesText(e.target.value)} className={inputClass} placeholder="Rust, Kubernetes, gRPC" />
      </label>

      <label className="block">
        <span className={labelClass}>Le Défi</span>
        <textarea value={form.challenge ?? ""} onChange={(e) => set("challenge", e.target.value)} className={`${inputClass} min-h-24`} />
      </label>

      <div>
        <span className={labelClass}>Statistiques</span>
        <div className="space-y-2">
          {(form.stats ?? []).map((stat, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={stat.value}
                onChange={(e) => updateStat(i, "value", e.target.value)}
                className={`${inputClass} w-24`}
                placeholder="+40%"
              />
              <input
                value={stat.label}
                onChange={(e) => updateStat(i, "label", e.target.value)}
                className={inputClass}
                placeholder="Efficiency Gain"
              />
              <button type="button" onClick={() => removeStat(i)} className="shrink-0 text-neutral-400 hover:text-destructive">
                <X className="size-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={addStat} className="text-xs font-medium text-primary hover:underline">
            + Ajouter une statistique
          </button>
        </div>
      </div>

      <label className="block">
        <span className={labelClass}>La Solution</span>
        <textarea value={form.solution ?? ""} onChange={(e) => set("solution", e.target.value)} className={`${inputClass} min-h-24`} />
      </label>

      <label className="block">
        <span className={labelClass}>Points clés de la solution (un par ligne)</span>
        <textarea
          value={solutionPointsText}
          onChange={(e) => setSolutionPointsText(e.target.value)}
          className={`${inputClass} min-h-24`}
        />
      </label>

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : project ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </form>
  );
}
