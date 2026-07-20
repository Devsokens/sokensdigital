"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  listBlogPosts,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  type BlogPostInput,
} from "@/lib/api/marketing";
import type { BlogPost, BlogPostStatus } from "@/lib/api/types";

const EMPTY: BlogPostInput = {
  title: "",
  excerpt: "",
  content: [],
  visual_icon: "",
  visual_label: "",
  visual_sublabel: "",
  tags: [],
  status: "BROUILLON",
  meta_description: "",
};

export function BlogPostList() {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [open, setOpen] = useState(false);

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

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Supprimer "${post.title}" ?`)) return;
    try {
      await deleteBlogPost(post.id);
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
          <SheetContent title="Nouvel article">
            <BlogPostForm
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
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Publié le</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {posts.map((post) => (
              <tr key={post.id} className="hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Sheet
                    open={open && editing?.id === post.id}
                    onOpenChange={(next) => {
                      setOpen(next);
                      setEditing(next ? post : null);
                    }}
                  >
                    <SheetTrigger
                      render={
                        <button type="button" className="text-neutral-900 hover:text-primary">
                          {post.title}
                        </button>
                      }
                    />
                    <SheetContent title="Modifier l'article">
                      <BlogPostForm
                        post={post}
                        onSaved={() => {
                          setOpen(false);
                          setEditing(null);
                          load();
                        }}
                      />
                    </SheetContent>
                  </Sheet>
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
          visual_label: post.visual_label,
          visual_sublabel: post.visual_sublabel,
          tags: post.tags,
          status: post.status,
          meta_description: post.meta_description,
        }
      : EMPTY
  );
  const [tagsText, setTagsText] = useState(post?.tags.join(", ") ?? "");
  const [contentText, setContentText] = useState(JSON.stringify(post?.content ?? [], null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BlogPostInput>(key: K, value: BlogPostInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let content: Record<string, unknown>[];
    try {
      content = JSON.parse(contentText);
      if (!Array.isArray(content)) throw new Error();
    } catch {
      setError('Le contenu doit être un tableau JSON valide (ex: [{"type":"p","text":"..."}]).');
      return;
    }

    const payload: BlogPostInput = {
      ...form,
      content,
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (post) {
        await updateBlogPost(post.id, payload);
      } else {
        await createBlogPost(payload);
      }
      onSaved();
    } catch {
      setError("Impossible d'enregistrer l'article.");
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

      <label className="block">
        <span className={labelClass}>Titre</span>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} className={inputClass} required />
      </label>

      <label className="block">
        <span className={labelClass}>Extrait</span>
        <textarea value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} className={`${inputClass} min-h-16`} />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Statut</span>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as BlogPostStatus)}
            className={inputClass}
          >
            <option value="BROUILLON">Brouillon</option>
            <option value="PUBLIE">Publié</option>
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Icône (lucide-react)</span>
          <input value={form.visual_icon} onChange={(e) => set("visual_icon", e.target.value)} className={inputClass} placeholder="ShieldCheck" />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Libellé visuel</span>
        <input value={form.visual_label} onChange={(e) => set("visual_label", e.target.value)} className={inputClass} />
      </label>

      <label className="block">
        <span className={labelClass}>Sous-libellé visuel</span>
        <input value={form.visual_sublabel} onChange={(e) => set("visual_sublabel", e.target.value)} className={inputClass} />
      </label>

      <label className="block">
        <span className={labelClass}>Tags (séparés par des virgules)</span>
        <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={inputClass} placeholder="AI Defense, Cloud Security" />
      </label>

      <label className="block">
        <span className={labelClass}>Meta description</span>
        <input value={form.meta_description} onChange={(e) => set("meta_description", e.target.value)} className={inputClass} />
      </label>

      <label className="block">
        <span className={labelClass}>Contenu (JSON — tableau de blocs)</span>
        <textarea
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          className={`${inputClass} min-h-48 font-mono text-xs`}
          spellCheck={false}
        />
        <span className="mt-1 block text-[0.7rem] text-neutral-400">
          Format : {`[{"type":"p","text":"..."}, {"type":"h2","text":"..."}]`} — voir lib/blog/types.ts côté frontend.
        </span>
      </label>

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : post ? "Enregistrer" : "Créer"}
        </Button>
      </div>
    </form>
  );
}
