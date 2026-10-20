"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ExternalLink, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { getSiteSettingsAdmin, listBlogPosts, listPageSections, listShowcaseProjects, updatePageSection, updateSiteSettings, type PageSectionInput } from "@/lib/api/marketing";
import { uploadImage } from "@/lib/api/upload";
import type { PageSection, SitePage, SiteSettings } from "@/lib/api/types";
import { toPost } from "@/lib/blog/public";
import { toProject } from "@/lib/projects/public";
import type { Project } from "@/lib/projects/types";
import { IconPicker, SectionIcon } from "@/components/admin/marketing/icon-picker";
import { FALLBACK_POST, toVitrinePost, type VitrinePost } from "@/components/vitrine/blog-data";
import type { Section } from "@/components/vitrine/cms";
import { ContactView } from "@/components/vitrine/contact-page";
import { EditContext, type EditContextValue, type EditRequest, type LinkValue } from "@/components/vitrine/editable";
import { ExpertiseView } from "@/components/vitrine/expertise-page";
import { HomeView } from "@/components/vitrine/home/home-view";
import { BlogView } from "@/components/vitrine/blog-page";
import { ProjectsView } from "@/components/vitrine/projects-page";
import { contactInfo } from "@/components/vitrine/ui";
import { VitrineFrame, type VitrinePage } from "@/components/vitrine/vitrine-frame";

/* Éditeur visuel du site vitrine, façon WordPress : la page s'affiche telle
 * qu'en ligne (mêmes composants), chaque texte, bouton, image ou liste se
 * modifie au clic, et l'enregistrement part directement dans le CMS. */

export type VitrineEditorPage = Extract<SitePage, "ACCUEIL" | "EXPERTISE" | "PROJETS" | "BLOG" | "CONTACT">;

const PAGES: Record<VitrineEditorPage, { path: string; frame: VitrinePage }> = {
  ACCUEIL: { path: "/", frame: "accueil" },
  EXPERTISE: { path: "/expertise", frame: "expertise" },
  PROJETS: { path: "/projects", frame: "projets" },
  BLOG: { path: "/blog", frame: "blog" },
  CONTACT: { path: "/contact", frame: "contact" },
};

type Data = { sections: PageSection[]; settings: SiteSettings; projects: Project[]; posts: VitrinePost[] };

export function VitrineEditor({ page }: { page: VitrineEditorPage }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [request, setRequest] = useState<EditRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Chaque onglet monte sa propre instance : `page` ne change pas pendant sa vie.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listPageSections(page),
      getSiteSettingsAdmin(),
      page === "ACCUEIL" || page === "PROJETS" ? listShowcaseProjects().then((r) => r.results) : Promise.resolve([]),
      page === "ACCUEIL" || page === "BLOG" ? listBlogPosts().then((r) => r.results) : Promise.resolve([]),
    ])
      .then(([sections, settings, projects, posts]) => {
        if (cancelled) return;
        const activeProjects = projects.filter((p) => p.is_active !== false);
        const homeProjects = activeProjects.filter((p) => p.show_on_homepage);
        setData({
          sections,
          settings,
          projects: (page === "ACCUEIL" ? (homeProjects.length ? homeProjects : activeProjects.slice(0, 2)) : activeProjects).map(toProject),
          posts: posts
            .filter((p) => p.status === "PUBLIE")
            .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
            .map((p) => toVitrinePost(toPost(p))),
        });
      })
      .catch(() => !cancelled && setError("Impossible de charger le contenu de la page."));
    return () => {
      cancelled = true;
    };
  }, [page]);

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }, []);

  const patchSection = useCallback(
    async (section: Section | undefined, patch: PageSectionInput) => {
      if (!section?.id) {
        throw new Error("Cette section n'existe pas encore dans le CMS : déployez la dernière version du backend (migrations) puis réessayez.");
      }
      const updated = await updatePageSection(section.id, patch);
      setData((d) => (d ? { ...d, sections: d.sections.map((s) => (s.id === updated.id ? updated : s)) } : d));
    },
    [],
  );

  const patchSettings = useCallback(async (patch: Partial<SiteSettings>) => {
    const updated = await updateSiteSettings(patch);
    setData((d) => (d ? { ...d, settings: { ...d.settings, ...updated } } : d));
  }, []);

  /** Lance une modification hors fenêtre (listes, visibilité) avec retour visuel. */
  const run = useCallback(
    async (task: () => Promise<void>, done: string) => {
      setBusy(true);
      try {
        await task();
        notify(done);
      } catch (err) {
        notify(err instanceof Error ? err.message : "Enregistrement impossible.");
      } finally {
        setBusy(false);
      }
    },
    [notify],
  );

  const save = useCallback(
    async (req: EditRequest, value: EditRequest["value"]) => {
      const { path, section } = req;
      switch (path.scope) {
        case "settings":
          return patchSettings({ [path.key]: value as string });
        case "legal": {
          const links = [...(data?.settings.legal_links ?? [])];
          links[path.index] = value as LinkValue;
          return patchSettings({ legal_links: links });
        }
        case "field": {
          const field = path.field;
          if (field === "cta" || field === "ctaSecondary") {
            const prefix = field === "cta" ? "cta" : "cta_secondary";
            if (typeof value === "string") return patchSection(section, { [`${prefix}_label`]: value });
            const link = value as LinkValue;
            return patchSection(section, { [`${prefix}_label`]: link.label, [`${prefix}_link`]: link.href });
          }
          return patchSection(section, { [field]: value as string });
        }
        case "item": {
          const items = (section?.items ?? []).map((item, i) => (i === path.index ? { ...item, [path.key]: value } : item));
          return patchSection(section, { items });
        }
        case "extra":
          return patchSection(section, { extra: { ...section?.extra, [path.key]: value } });
      }
    },
    [data?.settings.legal_links, patchSection, patchSettings],
  );

  const context = useMemo<EditContextValue>(
    () => ({
      open: setRequest,
      setItems: (section, items) => run(() => patchSection(section, { items }), "Liste mise à jour"),
      toggleSection: (section) => run(() => patchSection(section, { is_active: !section.isActive }), section.isActive ? "Section masquée sur le site" : "Section de nouveau visible"),
      setLegalLinks: (links) => run(() => patchSettings({ legal_links: links }), "Liens mis à jour"),
      legalLinks: data?.settings.legal_links ?? [],
    }),
    [data?.settings.legal_links, patchSection, patchSettings, run],
  );

  // Aperçu : les liens ne naviguent pas (un clic sur un texte ouvre l'édition).
  const blockLinks = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("a")) event.preventDefault();
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const { path, frame } = PAGES[page];
  const { email, phone } = contactInfo(data.settings);
  const post = data.posts[0] ?? FALLBACK_POST;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-neutral-600">
          <Pencil className="size-4 text-primary" />
          Cliquez sur un texte, un bouton ou une image pour le modifier. Survolez une section pour la masquer.
        </p>
        <div className="flex items-center gap-3">
          {busy && <Loader2 className="size-4 animate-spin text-neutral-400" />}
          <a href={path} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-700 hover:text-neutral-900">
            Voir la page en ligne <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
        <div className="flex h-9 items-center gap-1.5 border-b border-neutral-200 bg-neutral-100 px-3">
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="size-2.5 rounded-full bg-neutral-300" />
          <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 font-mono text-[11px] text-neutral-500">sokensdigital.com{path === "/" ? "" : path}</span>
        </div>
        <div className="h-[calc(100dvh-220px)] min-h-[560px] overflow-y-auto" onClickCapture={blockLinks}>
          <EditContext.Provider value={context}>
            <VitrineFrame page={frame} settings={data.settings} previewPath={path}>
              {page === "ACCUEIL" && <HomeView sections={data.sections} projects={data.projects} post={post} phone={phone} />}
              {page === "EXPERTISE" && <ExpertiseView sections={data.sections} />}
              {page === "PROJETS" && <ProjectsView sections={data.sections} projects={data.projects} />}
              {page === "BLOG" && <BlogView sections={data.sections} featured={post} posts={data.posts.slice(1)} />}
              {page === "CONTACT" && <ContactView sections={data.sections} email={email} phone={phone} />}
            </VitrineFrame>
          </EditContext.Provider>
        </div>
      </div>

      {request && <EditDialog request={request} onClose={() => setRequest(null)} onSave={async (value) => {
        await save(request, value);
        setRequest(null);
        notify("Modification enregistrée");
      }} />}

      {toast && (
        <div role="status" className="fixed right-6 bottom-6 z-[120] rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- fenêtre de modification ---------- */

const TITLES: Record<EditRequest["kind"], string> = {
  text: "Modifier ce texte",
  textarea: "Modifier ce texte",
  list: "Modifier la liste",
  link: "Modifier ce bouton",
  image: "Modifier l'image",
  icon: "Choisir une icône",
};

const TITLE_HINT = "Astuce : mettez entre *astérisques* la partie à afficher en dégradé.";

export function EditDialog({ request, onClose, onSave }: { request: EditRequest; onClose: () => void; onSave: (value: EditRequest["value"]) => Promise<void> }) {
  const initial = request.kind === "list" && Array.isArray(request.value) ? request.value.join("\n") : request.value;
  const [value, setValue] = useState<EditRequest["value"]>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const isTitle = request.path.scope === "field" && request.path.field === "title";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      const out = request.kind === "list" ? String(value).split("\n").map((v) => v.trim()).filter(Boolean) : value;
      await onSave(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
      setSaving(false);
    }
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setValue(await uploadImage(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'envoi de l'image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const field = "w-full rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-[15px] text-neutral-900 outline-none transition-colors focus:border-primary";
  const link = (typeof value === "object" && !Array.isArray(value) ? value : { label: "", href: "" }) as LinkValue;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-neutral-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={TITLES[request.kind]} className="w-full max-w-xl rounded-3xl bg-white p-7 shadow-2xl">
        <p className="flex items-center gap-2 text-[15px] font-bold text-primary">
          <Pencil className="size-4" /> {TITLES[request.kind]}
        </p>
        <p className="mt-3 text-center font-mono text-xs text-neutral-400">{request.label}</p>

        <div className="mt-4">
          {request.kind === "text" && (
            <input autoFocus className={field} value={String(value)} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          )}
          {(request.kind === "textarea" || request.kind === "list") && (
            <textarea autoFocus rows={request.kind === "list" ? 5 : 4} className={`${field} resize-y leading-relaxed`} value={String(value)} onChange={(e) => setValue(e.target.value)} />
          )}
          {request.kind === "link" && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-neutral-500">
                Texte du bouton
                <input autoFocus className={`${field} mt-1.5`} value={link.label} onChange={(e) => setValue({ ...link, label: e.target.value })} />
              </label>
              <label className="block text-xs font-semibold text-neutral-500">
                Lien (page du site comme /contact, ou adresse complète)
                <input className={`${field} mt-1.5 font-mono text-sm`} value={link.href} onChange={(e) => setValue({ ...link, href: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submit()} />
              </label>
            </div>
          )}
          {request.kind === "image" && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-900">
                {uploading ? (
                  <Loader2 className="size-6 animate-spin text-white/60" />
                ) : value ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(value)} alt="" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-sm text-white/50">Aucune image</span>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                  <ImagePlus className="size-4" /> Choisir une image
                </button>
                {value && (
                  <button type="button" onClick={() => setValue("")} className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                    <Trash2 className="size-4" /> Retirer
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.svg" onChange={upload} className="hidden" />
            </div>
          )}
          {request.kind === "icon" && (
            <div className="flex items-center justify-center gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                <SectionIcon name={String(value)} className="size-6" />
              </span>
              <IconPicker value={String(value)} onChange={(name) => setValue(name)} />
            </div>
          )}
        </div>

        {(request.hint || isTitle) && <p className="mt-3 text-xs leading-relaxed text-neutral-500">{request.hint ?? TITLE_HINT}</p>}
        {request.kind === "list" && !request.hint && <p className="mt-3 text-xs text-neutral-500">Un élément par ligne.</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800">
            Annuler
          </button>
          <button type="button" onClick={submit} disabled={saving || uploading} className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {saving && <Loader2 className="size-4 animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
