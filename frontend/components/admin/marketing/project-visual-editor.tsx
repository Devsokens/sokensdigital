"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowLeftRight, ExternalLink, ImagePlus, Loader2, Pencil, Video, X } from "lucide-react";
import { getSiteSettingsAdmin, listPageSections, updateShowcaseProject, type ShowcaseProjectInput } from "@/lib/api/marketing";
import { uploadImage, uploadVideo } from "@/lib/api/upload";
import type { PageSection, ShowcaseProject, SiteSettings } from "@/lib/api/types";
import { toProject } from "@/lib/projects/public";
import { EditDialog } from "@/components/admin/marketing/vitrine-editor";
import { resolveSection } from "@/components/vitrine/cms";
import { PROJECTS_CTA } from "@/components/vitrine/defaults";
import { EditContext, type EditContextValue, type EditRequest } from "@/components/vitrine/editable";
import { ProjectDetailView } from "@/components/vitrine/project-detail";
import { VitrineFrame } from "@/components/vitrine/vitrine-frame";

/* Éditeur visuel d'un projet vitrine : la page /projects/<slug> telle qu'en
 * ligne, chaque champ modifiable au clic (enregistré aussitôt). La barre du
 * haut regroupe ce qui n'a pas d'équivalent visible : visibilité, accueil,
 * ordre, captures d'écran et vidéo. */

export function ProjectVisualEditor({ project: initial, allProjects, onBack, onChange }: { project: ShowcaseProject; allProjects: ShowcaseProject[]; onBack: () => void; onChange: (project: ShowcaseProject) => void }) {
  const [project, setProject] = useState(initial);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [sections, setSections] = useState<PageSection[]>([]);
  const [request, setRequest] = useState<EditRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSiteSettingsAdmin().then(setSettings).catch(() => {});
    listPageSections("PROJETS").then(setSections).catch(() => {});
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }

  async function patch(data: Partial<ShowcaseProjectInput>, done = "Modification enregistrée") {
    setBusy(true);
    try {
      const updated = await updateShowcaseProject(project.id!, data);
      setProject(updated);
      onChange(updated);
      notify(done);
    } catch {
      notify("Enregistrement impossible.");
      throw new Error("Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  /** Valeur de la fenêtre → champ(s) du projet. */
  async function save(req: EditRequest, value: EditRequest["value"]) {
    if (req.path.scope !== "project") return;
    const { key, index } = req.path;
    if (key === "images" && index !== undefined) {
      const images = [...project.images];
      if (value) images[index] = value as string;
      else images.splice(index, 1);
      return patch({ images });
    }
    if (key === "stats") {
      const stats = (value as string[]).map((line) => {
        const [first, ...rest] = line.split("|");
        return { value: first.trim(), label: rest.join("|").trim() };
      });
      return patch({ stats });
    }
    return patch({ [key]: value } as Partial<ShowcaseProjectInput>);
  }

  async function upload(file: File, kind: "image" | "video") {
    setBusy(true);
    try {
      if (kind === "image") {
        const url = await uploadImage(file);
        await patch({ images: [...project.images, url] }, "Capture ajoutée");
      } else {
        const url = await uploadVideo(file);
        await patch({ video_src: url }, "Vidéo ajoutée");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  const context = useMemo<EditContextValue>(
    () => ({ open: setRequest, setItems: () => {}, toggleSection: () => {}, setLegalLinks: () => {}, legalLinks: [] }),
    [],
  );

  const view = toProject(project);
  const related = allProjects.filter((p) => p.id !== project.id && p.is_active !== false).slice(0, 3).map(toProject);
  const moveImage = (from: number, to: number) => {
    const images = [...project.images];
    const [img] = images.splice(from, 1);
    images.splice(to, 0, img);
    patch({ images }, "Ordre des captures mis à jour").catch(() => {});
  };

  return (
    <div className="space-y-3">
      <div className="space-y-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900">
            <ArrowLeft className="size-4" /> Tous les projets
          </button>
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-700">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={project.is_active ?? true} onChange={(e) => patch({ is_active: e.target.checked }).catch(() => {})} /> Visible sur le site
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={project.show_on_homepage ?? false} onChange={(e) => patch({ show_on_homepage: e.target.checked }).catch(() => {})} /> Sur l&apos;accueil
            </label>
            <label className="flex items-center gap-1.5">
              Ordre
              <input type="number" defaultValue={project.order ?? 0} onBlur={(e) => Number(e.target.value) !== project.order && patch({ order: Number(e.target.value) }).catch(() => {})} className="w-16 rounded-md border border-neutral-200 px-2 py-1" />
            </label>
            {busy && <Loader2 className="size-4 animate-spin text-neutral-400" />}
            <a href={`/projects/${project.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:text-neutral-900">
              Voir en ligne <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3">
          <span className="mr-1 text-xs font-semibold text-neutral-500">Captures d&apos;écran</span>
          {project.images.map((url, i) => (
            <div key={url + i} className="group relative h-14 w-24 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover object-top" />
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
                {i > 0 && (
                  <button type="button" title="Mettre en premier" onClick={() => moveImage(i, 0)} className="rounded bg-white/90 p-1 text-neutral-800">
                    <ArrowLeftRight className="size-3" />
                  </button>
                )}
                <button type="button" title="Retirer" onClick={() => window.confirm("Retirer cette capture ?") && patch({ images: project.images.filter((_, j) => j !== i) }, "Capture retirée").catch(() => {})} className="rounded bg-white/90 p-1 text-neutral-800">
                  <X className="size-3" />
                </button>
              </div>
              {i === 0 && <span className="absolute bottom-0.5 left-0.5 rounded bg-black/70 px-1 text-[9px] text-white">Principale</span>}
            </div>
          ))}
          <button type="button" onClick={() => imageInput.current?.click()} className="inline-flex h-14 items-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 text-xs font-medium text-neutral-600 hover:border-neutral-400">
            <ImagePlus className="size-4" /> Ajouter
          </button>
          <span className="mx-2 h-8 w-px bg-neutral-200" />
          <button type="button" onClick={() => videoInput.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
            <Video className="size-4" /> {project.video_src ? "Remplacer la vidéo" : "Ajouter une vidéo"}
          </button>
          {project.video_src && (
            <button type="button" onClick={() => patch({ video_src: "" }, "Vidéo retirée").catch(() => {})} className="text-xs text-neutral-500 hover:text-red-600">
              Retirer la vidéo
            </button>
          )}
          <input ref={imageInput} type="file" accept=".png,.jpg,.jpeg,.webp,.gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "image"); e.target.value = ""; }} />
          <input ref={videoInput} type="file" accept=".mp4,.webm,.mov" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, "video"); e.target.value = ""; }} />
        </div>
        <p className="flex items-center gap-2 text-xs text-neutral-500">
          <Pencil className="size-3.5 text-primary" /> Cliquez sur un texte de la page pour le modifier : il est enregistré aussitôt.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex h-9 items-center gap-1.5 border-b border-neutral-200 bg-neutral-100 px-3">
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 font-mono text-[11px] text-neutral-500">sokensdigital.com/projects/{project.slug}</span>
        </div>
        <div className="h-[calc(100dvh-260px)] min-h-[560px] overflow-y-auto" onClickCapture={(e) => (e.target as HTMLElement).closest("a") && e.preventDefault()}>
          {settings ? (
            <VitrineFrame page="projets" settings={settings} previewPath="/projects">
              <EditContext.Provider value={context}>
                <ProjectDetailView project={view} related={related} cta={resolveSection(sections, "projects_cta", PROJECTS_CTA)} editing />
              </EditContext.Provider>
            </VitrineFrame>
          ) : (
            <div className="flex justify-center py-16">
              <Loader2 className="size-6 animate-spin text-neutral-400" />
            </div>
          )}
        </div>
      </div>

      {request && (
        <EditDialog
          request={request}
          onClose={() => setRequest(null)}
          onSave={async (value) => {
            await save(request, value);
            setRequest(null);
          }}
        />
      )}

      {toast && (
        <div role="status" className="fixed right-6 bottom-6 z-[120] rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
