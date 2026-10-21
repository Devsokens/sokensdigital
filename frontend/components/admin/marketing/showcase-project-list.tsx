"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, LayoutGrid, List, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ProjectCardMedia } from "@/components/projects/card-media";
import { ProjectVisualEditor } from "@/components/admin/marketing/project-visual-editor";
import { ApiError } from "@/lib/api/client";
import { listShowcaseProjects, createShowcaseProject, deleteShowcaseProject } from "@/lib/api/marketing";
import type { ShowcaseProject } from "@/lib/api/types";

/* Projets vitrine : liste (cartes ou tableau) ; « Modifier » ouvre la page de
 * détail du projet telle qu'en ligne, modifiable au clic (ProjectVisualEditor). */

export function ShowcaseProjectList() {
  const [projects, setProjects] = useState<ShowcaseProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<"list" | "card">("card");

  async function load() {
    try {
      const data = await listShowcaseProjects();
      setProjects(data.results);
    } catch {
      setError("Impossible de charger les projets.");
    }
  }

  useEffect(() => {
    listShowcaseProjects()
      .then((data) => setProjects(data.results))
      .catch(() => setError("Impossible de charger les projets."));
  }, []);

  /** Recharge la liste avant d'ouvrir un projet : ses textes ont pu être
   * modifiés entre-temps depuis l'aperçu de la page Projets, au-dessus. */
  async function openProject(id: string | undefined) {
    if (!id) return;
    await load();
    setSelectedId(id);
  }

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

  const selected = projects.find((p) => p.id === selectedId);
  if (selected) {
    return (
      <ProjectVisualEditor
        key={selected.id}
        project={selected}
        allProjects={projects}
        onBack={() => setSelectedId(null)}
        onChange={(updated) => setProjects((list) => list?.map((p) => (p.id === updated.id ? updated : p)) ?? null)}
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-end gap-2">
        <div className="flex items-center rounded-full border border-neutral-200 p-0.5">
          <button
            type="button"
            onClick={() => setView("card")}
            aria-label="Vue carte"
            aria-pressed={view === "card"}
            className={cn("flex size-8 items-center justify-center rounded-full transition-colors", view === "card" ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-700")}
          >
            <LayoutGrid className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            aria-label="Vue liste"
            aria-pressed={view === "list"}
            className={cn("flex size-8 items-center justify-center rounded-full transition-colors", view === "list" ? "bg-neutral-900 text-white" : "text-neutral-400 hover:text-neutral-700")}
          >
            <List className="size-4" />
          </button>
        </div>
        <Sheet open={creating} onOpenChange={setCreating}>
          <SheetTrigger
            render={
              <Button className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Nouveau projet
              </Button>
            }
          />
          <SheetContent title="Nouveau projet" className="max-w-md">
            <NewProjectForm
              onCreated={(project) => {
                setCreating(false);
                setProjects((list) => [...(list ?? []), project]);
                setSelectedId(project.id ?? null);
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      {projects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 py-16 text-center text-sm text-neutral-400">Aucun projet pour l&apos;instant.</p>
      ) : view === "card" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="group overflow-hidden rounded-2xl border-2 border-primary/25 bg-[#0a0e13] transition-colors hover:border-primary/70">
              <button type="button" onClick={() => openProject(project.id)} className="relative flex aspect-video w-full items-center justify-center overflow-hidden">
                <ProjectCardMedia images={project.images} videoSrc={project.video_src} icon={project.visual_icon} />
                {project.show_on_homepage && (
                  <span className="absolute top-3 right-3 z-10 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-primary-foreground uppercase">Accueil</span>
                )}
                {!project.is_active && (
                  <span className="absolute top-3 left-3 z-10 rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-white/70 uppercase">Masqué</span>
                )}
              </button>
              <div className="p-4">
                <span className="text-xs text-muted-foreground">{project.client}</span>
                <h3 className="mt-1 text-base font-semibold text-foreground">{project.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{[project.sector, project.type, project.timeline].filter(Boolean).join(" · ")}</p>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <button type="button" onClick={() => openProject(project.id)} className="text-xs font-medium text-primary hover:underline">
                    Modifier
                  </button>
                  <div className="flex items-center gap-3">
                    <Link href={`/projects/${project.slug}`} target="_blank" aria-label="Voir le projet" className="text-muted-foreground transition-colors hover:text-primary">
                      <ExternalLink className="size-3.5" />
                    </Link>
                    <button type="button" onClick={() => handleDelete(project)} aria-label="Supprimer" className="text-muted-foreground transition-colors hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
          <table className="table-responsive w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Secteur</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3" data-label="Titre">
                    <button type="button" onClick={() => openProject(project.id)} className="text-neutral-900 hover:text-primary">
                      {project.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-neutral-500" data-label="Secteur">{project.sector}</td>
                  <td className="px-4 py-3" data-label="Statut">
                    <span className={project.is_active ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary" : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500"}>
                      {project.is_active ? "Visible" : "Masqué"}
                    </span>
                    {project.show_on_homepage && <span className="ml-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Accueil</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/projects/${project.slug}`} target="_blank" aria-label="Voir le projet" className="text-neutral-400 hover:text-primary">
                        <ExternalLink className="size-4" />
                      </Link>
                      <button type="button" onClick={() => handleDelete(project)} aria-label="Supprimer" className="text-neutral-400 hover:text-destructive">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Création : les trois champs obligatoires, puis tout le reste se remplit
 * directement sur la page du projet dans l'éditeur visuel. */
function NewProjectForm({ onCreated }: { onCreated: (project: ShowcaseProject) => void }) {
  const [title, setTitle] = useState("");
  const [sector, setSector] = useState("");
  const [type, setType] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const project = await createShowcaseProject({ title: title.trim(), sector: sector.trim(), type: type.trim(), category: sector.trim(), is_active: false });
      onCreated(project);
    } catch (err) {
      setError(err instanceof ApiError ? "Vérifiez les champs : ce titre existe peut-être déjà." : "Impossible de créer le projet.");
    } finally {
      setSaving(false);
    }
  }

  const field = "mt-1.5 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-primary";
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-neutral-500">Le projet est créé masqué : complétez sa page (textes, captures…) puis cochez « Visible sur le site ».</p>
      <label className="block text-xs font-semibold text-neutral-600">
        Nom du projet
        <input required value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Ex. : Workclass" />
      </label>
      <label className="block text-xs font-semibold text-neutral-600">
        Secteur
        <input required value={sector} onChange={(e) => setSector(e.target.value)} className={field} placeholder="Ex. : Événementiel" />
      </label>
      <label className="block text-xs font-semibold text-neutral-600">
        Type
        <input required value={type} onChange={(e) => setType(e.target.value)} className={field} placeholder="Ex. : Plateforme web" />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      <Button type="submit" disabled={saving} className="w-full gap-1.5 rounded-full">
        {saving && <Loader2 className="size-4 animate-spin" />} Créer et ouvrir la page du projet
      </Button>
    </form>
  );
}
