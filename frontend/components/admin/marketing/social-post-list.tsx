"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, CalendarClock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  listSocialPosts,
  createSocialPost,
  deleteSocialPost,
  scheduleSocialPost,
  cancelSocialPost,
  type SocialPostInput,
} from "@/lib/api/marketing";
import type { SocialPost, SocialPostStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/auth-context";

const STATUS_LABELS: Record<SocialPostStatus, string> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmé",
  PUBLISHED: "Publié",
  FAILED: "Échec",
  CANCELLED: "Annulé",
};

const STATUS_COLORS: Record<SocialPostStatus, string> = {
  DRAFT: "bg-neutral-100 text-neutral-500",
  SCHEDULED: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-neutral-100 text-neutral-400",
};

const EMPTY: SocialPostInput = {
  title: "",
  content: "",
  image_path: "",
  platform: "LINKEDIN",
  scheduled_at: "",
  notes: "",
  tags: [],
};

export function SocialPostList() {
  const { profile } = useAuth();
  const isMarketing = profile?.role === "RESPONSABLE_MARKETING" || profile?.role === "SUPER_ADMIN";
  const [posts, setPosts] = useState<SocialPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await listSocialPosts();
      setPosts(data.results);
    } catch {
      setError("Impossible de charger le plan éditorial.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSchedule(post: SocialPost) {
    setBusyId(post.id);
    try {
      await scheduleSocialPost(post.id);
      load();
    } catch {
      setError(`Impossible de programmer "${post.title}" — assure-toi qu'une date est renseignée.`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(post: SocialPost) {
    setBusyId(post.id);
    try {
      await cancelSocialPost(post.id);
      load();
    } catch {
      setError(`Impossible d'annuler "${post.title}".`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(post: SocialPost) {
    if (!confirm(`Supprimer "${post.title}" ?`)) return;
    try {
      await deleteSocialPost(post.id);
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
          <h1 className="text-2xl font-semibold text-neutral-900">Plan Éditorial</h1>
          <p className="text-sm text-neutral-500">
            {isMarketing
              ? "Création, planification et annulation des publications réseaux sociaux."
              : "Rôle de proposition — tes brouillons attendent une validation Marketing."}
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Nouvelle publication
              </Button>
            }
          />
          <SheetContent title="Nouvelle publication">
            <SocialPostForm onSaved={() => { setOpen(false); load(); }} />
          </SheetContent>
        </Sheet>
      </div>

      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
        La publication automatique vers les réseaux sociaux (et les rappels J-3h/J-2h/J-1h) n&apos;est pas encore
        connectée — aucune plateforme externe n&apos;est configurée. Cet écran gère le statut et la planification en interne.
      </p>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Titre</th>
              <th className="px-4 py-3 font-medium">Plateforme</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Programmé pour</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {posts.map((post) => (
              <tr key={post.id}>
                <td className="px-4 py-3">
                  <p className="text-neutral-900">{post.title}</p>
                  <p className="max-w-xs truncate text-xs text-neutral-400">{post.content}</p>
                </td>
                <td className="px-4 py-3 text-neutral-500">{post.platform}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[post.status]}`}>
                    {STATUS_LABELS[post.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString("fr-FR") : "—"}
                </td>
                <td className="px-4 py-3">
                  {isMarketing && (
                    <div className="flex items-center justify-end gap-2">
                      {post.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={() => handleSchedule(post)}
                          disabled={busyId === post.id}
                          aria-label="Programmer"
                          className="text-neutral-400 hover:text-primary"
                        >
                          <CalendarClock className="size-4" />
                        </button>
                      )}
                      {(post.status === "DRAFT" || post.status === "SCHEDULED") && (
                        <button
                          type="button"
                          onClick={() => handleCancel(post)}
                          disabled={busyId === post.id}
                          aria-label="Annuler"
                          className="text-neutral-400 hover:text-amber-600"
                        >
                          <Ban className="size-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(post)}
                        aria-label="Supprimer"
                        className="text-neutral-400 hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {posts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  Aucune publication pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SocialPostForm({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState<SocialPostInput>(EMPTY);
  const [tagsText, setTagsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof SocialPostInput>(key: K, value: SocialPostInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createSocialPost({
        ...form,
        scheduled_at: form.scheduled_at || undefined,
        tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      });
      onSaved();
    } catch {
      setError("Impossible de créer la publication — vérifie les contraintes par plateforme (280 caractères max sur X, image obligatoire sur Instagram).");
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
        <span className={labelClass}>Plateforme</span>
        <select value={form.platform} onChange={(e) => set("platform", e.target.value)} className={inputClass}>
          <option value="LINKEDIN">LinkedIn</option>
          <option value="TWITTER">Twitter/X</option>
          <option value="FACEBOOK">Facebook</option>
          <option value="INSTAGRAM">Instagram</option>
          <option value="YOUTUBE">YouTube</option>
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Contenu</span>
        <textarea value={form.content} onChange={(e) => set("content", e.target.value)} className={`${inputClass} min-h-28`} required />
      </label>

      <label className="block">
        <span className={labelClass}>Image (URL)</span>
        <input value={form.image_path} onChange={(e) => set("image_path", e.target.value)} className={inputClass} placeholder="https://..." />
      </label>

      <label className="block">
        <span className={labelClass}>Tags (séparés par des virgules)</span>
        <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className={inputClass} />
      </label>

      <label className="block">
        <span className={labelClass}>Notes internes</span>
        <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={`${inputClass} min-h-16`} />
      </label>

      <p className="text-xs text-neutral-400">
        La publication est créée en brouillon — la planification (date + passage à &quot;Programmé&quot;) se fait ensuite depuis la liste.
      </p>

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Créer"}
        </Button>
      </div>
    </form>
  );
}
