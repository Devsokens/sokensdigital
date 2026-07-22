"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, LayoutGrid, List, Loader2, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { ApiError } from "@/lib/api/client";
import { ImageUploadField } from "@/components/admin/marketing/page-section-editor";
import { IconPicker } from "@/components/admin/marketing/icon-picker";
import { BlockListEditor } from "@/components/admin/marketing/block-list-editor";
import { ProjectCardMedia } from "@/components/projects/card-media";
import {
  listBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  type BlogPostInput,
} from "@/lib/api/marketing";
import type { BlogPost, BlogPostStatus } from "@/lib/api/types";
import type { Block } from "@/lib/blog/types";

const EMPTY: BlogPostInput = {
  title: "",
  excerpt: "",
  content: [],
  visual_icon: "shield-check",
  visual_image: "",
  visual_label: "",
  visual_sublabel: "",
  tags: [],
  status: "BROUILLON",
  meta_description: "",
};

function authorName(author: BlogPost["author"]): string {
  if (!author) return "";
  if (typeof author === "string") return author;
  return `${author.first_name} ${author.last_name}`.trim();
}

export function BlogPostList() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "card">("card");

  async function load() {
    try {
      const data = await listBlogPosts();
      setPosts(data.results);
    } catch {
      setError("Impossible de charger les articles.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function edit(post: BlogPost) {
    setEditing(post);
    setOpen(true);
  }

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Supprimer "${post.title}" ?`)) return;
    try {
      await deleteBlogPost(post.id!);
      load();
    } catch {
      setError(`Impossible de supprimer "${post.title}".`);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!posts) {
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
          <h1 className="text-2xl font-semibold text-neutral-900">Blog</h1>
          <p className="text-sm text-neutral-500">Articles de la vitrine publique.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-neutral-200 p-0.5">
            <button
              type="button"
              onClick={() => setView("card")}
              aria-label="Vue carte"
              aria-pressed={view === "card"}
              className={cn("rounded-full p-1.5", view === "card" ? "bg-neutral-900 text-white" : "text-neutral-500")}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="Vue liste"
              aria-pressed={view === "list"}
              className={cn("rounded-full p-1.5", view === "list" ? "bg-neutral-900 text-white" : "text-neutral-500")}
            >
              <List className="size-4" />
            </button>
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
                  <Plus className="size-4" /> Nouvel article
                </Button>
              }
            />
            <SheetContent title="Nouvel article" className="max-w-3xl">
              <BlogPostForm
                onSaved={() => {
                  setOpen(false);
                  load();
                }}
              />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <Sheet
        open={open && !!editing}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
      >
        <SheetContent title="Modifier l'article" className="max-w-3xl">
          {editing && (
            <BlogPostForm
              post={editing}
              onSaved={() => {
                setOpen(false);
                setEditing(null);
                load();
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {view === "list" ? (
        <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Titre</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Publié le</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => edit(post)} className="text-neutral-900 hover:text-primary">
                      {post.title}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        post.status === "PUBLIE"
                          ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500"
                      }
                    >
                      {post.status === "PUBLIE" ? "Publié" : "Brouillon"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(post)}
                      aria-label="Supprimer"
                      className="text-neutral-400 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                    Aucun article pour l&apos;instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <div key={post.id} className="group overflow-hidden rounded-2xl border-2 border-primary/25 bg-[#0a0e13] transition-colors hover:border-primary/70">
              <button type="button" onClick={() => edit(post)} className="relative flex aspect-video w-full items-center justify-center overflow-hidden">
                <ProjectCardMedia images={post.visual_image ? [post.visual_image] : undefined} icon={post.visual_icon} />
                <span
                  className={cn(
                    "absolute top-3 left-3 z-10 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.1em] uppercase",
                    post.status === "PUBLIE" ? "bg-primary text-primary-foreground" : "bg-black/60 text-white/70"
                  )}
                >
                  {post.status === "PUBLIE" ? "Publié" : "Brouillon"}
                </span>
              </button>
              <div className="p-4">
                <span className="text-xs text-muted-foreground">
                  {post.published_at ? new Date(post.published_at).toLocaleDateString("fr-FR") : "Non publié"}
                </span>
                <h3 className="mt-1 text-base font-semibold text-foreground">{post.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{post.excerpt}</p>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <button type="button" onClick={() => edit(post)} className="text-xs font-medium text-primary hover:underline">
                    Modifier
                  </button>
                  <button type="button" onClick={() => handleDelete(post)} aria-label="Supprimer" className="text-muted-foreground/60 hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-neutral-400">Aucun article pour l&apos;instant.</p>
          )}
        </div>
      )}
    </div>
  );
}

function BlogPostForm({ post, onSaved }: { post?: BlogPost; onSaved: () => void }) {
  const [form, setForm] = useState<BlogPostInput>(
    post
      ? {
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          visual_icon: post.visual_icon,
          visual_image: post.visual_image,
          visual_label: post.visual_label,
          visual_sublabel: post.visual_sublabel,
          tags: post.tags,
          status: post.status ?? "BROUILLON",
          meta_description: post.meta_description ?? "",
        }
      : EMPTY
  );
  const [tagsText, setTagsText] = useState(post?.tags.join(", ") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError("Champ requis manquant : Titre.");
      return;
    }

    const payload: BlogPostInput = {
      ...form,
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (post) {
        await updateBlogPost(post.id!, payload);
      } else {
        await createBlogPost(payload);
      }
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === "object") {
        const fieldErrors = Object.entries(err.body as Record<string, unknown>)
          .map(([field, msgs]) => `${field} : ${Array.isArray(msgs) ? msgs.join(" ") : String(msgs)}`)
          .join(" — ");
        setError(fieldErrors || "Impossible d'enregistrer l'article.");
      } else {
        setError("Impossible d'enregistrer l'article.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Faithful reproduction of /blog/[slug]'s header, directly editable */}
      <div className="rounded-2xl bg-[#0a0e13] p-5 sm:p-8">
        {/* Admin-only meta — no public equivalent to reproduce */}
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
          <label className="flex items-center gap-1.5 text-sm text-foreground/80">
            Statut
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="rounded-md bg-white/[0.06] px-2 py-1 text-sm text-foreground ring-1 ring-white/10 outline-none focus:ring-primary/50"
            >
              <option value="BROUILLON" className="bg-background">Brouillon</option>
              <option value="PUBLIE" className="bg-background">Publié</option>
            </select>
          </label>
          {post && (
            <span className="text-sm text-foreground/80">
              Auteur : {authorName(post.author) || "—"}
            </span>
          )}
          {post?.slug && (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Voir l&apos;article <ExternalLink className="size-3" />
            </Link>
          )}
        </div>

        {/* Article visual — mirrors ArticleVisual: image first, else the icon, with an editable caption overlay */}
        <div className="relative flex aspect-[21/9] items-center justify-center overflow-hidden rounded-2xl border-2 border-primary/25">
          <ProjectCardMedia
            images={form.visual_image ? [form.visual_image] : undefined} icon={form.visual_icon}
            iconClassName="relative size-16 text-primary/40 sm:size-20"
          />
          <div className="absolute right-3 top-3 z-10">
            <IconPicker value={form.visual_icon} onChange={(v) => set("visual_icon", v)} />
          </div>
          <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-5 py-4">
            <input
              value={form.visual_label} onChange={(e) => set("visual_label", e.target.value)}
              className="block w-full bg-transparent text-xs font-semibold tracking-[0.15em] text-foreground uppercase outline-none placeholder:text-foreground/40"
              placeholder="LIBELLÉ DU VISUEL"
            />
            <input
              value={form.visual_sublabel} onChange={(e) => set("visual_sublabel", e.target.value)}
              className="mt-0.5 block w-full bg-transparent text-[11px] text-muted-foreground outline-none placeholder:text-muted-foreground/50"
              placeholder="Sous-libellé du visuel"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <ImageUploadField value={form.visual_image} onChange={(url) => set("visual_image", url)} />
          {form.visual_image && (
            <button type="button" onClick={() => set("visual_image", "")} className="text-muted-foreground transition-colors hover:text-destructive">
              <X className="size-4" />
            </button>
          )}
          <p className="text-[0.65rem] text-muted-foreground/60">
            Remplace l&apos;icône par une photo de couverture — laisse vide pour garder l&apos;icône.
          </p>
        </div>

        <input
          value={form.title} onChange={(e) => set("title", e.target.value)}
          className="mt-6 block w-full bg-transparent text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-4xl"
          placeholder="Titre de l'article"
        />
        <textarea
          value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)}
          className="mt-3 block w-full max-w-2xl resize-none bg-transparent text-sm text-muted-foreground outline-none placeholder:text-muted-foreground/40 sm:text-base"
          placeholder="Extrait affiché sur les cartes"
          rows={2}
        />
        <input
          value={tagsText} onChange={(e) => setTagsText(e.target.value)}
          className="mt-4 block w-full max-w-md bg-transparent text-xs text-primary outline-none placeholder:text-muted-foreground/40"
          placeholder="Tags séparés par des virgules"
        />
      </div>

      <label className="block">
        <span className={labelClass}>Meta description (SEO)</span>
        <input value={form.meta_description} onChange={(e) => set("meta_description", e.target.value)} className={inputClass} />
      </label>

      <div>
        <span className={labelClass}>Contenu de l&apos;article</span>
        <div className="mt-1.5">
          <BlockListEditor blocks={form.content as unknown as Block[]} onChange={(blocks) => set("content", blocks as unknown as Record<string, unknown>[])} />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : post ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </form>
  );
}
