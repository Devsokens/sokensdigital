"use client";

import { useEffect, useState } from "react";
import { Check, EyeOff, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  deleteBlogComment,
  listBlogComments,
  moderateBlogComment,
  type BlogCommentAdmin,
  type BlogCommentStatus,
} from "@/lib/api/marketing";

const STATUS_LABEL: Record<BlogCommentStatus, string> = {
  VISIBLE: "Visible",
  MASQUE: "Masqué",
};

const FLAG_LABEL: Record<NonNullable<BlogCommentAdmin["flag_reason"]>, string> = {
  MOTS_INTERDITS: "Filtre automatique",
  SIGNALEMENTS: "Signalé par des lecteurs",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** File de modération des commentaires du blog public — département
 * Marketing & Communication (ROLE_RESPONSABLE_MARKETING / Super-Admin,
 * voir BlogCommentModerationViewSet côté backend). Les commentaires vivent
 * dans Firestore, pas Postgres, donc pas de pagination classique ici :
 * `listBlogComments` remonte jusqu'à 500 commentaires, tous statuts
 * confondus par défaut. */
export function CommentModeration() {
  const [comments, setComments] = useState<BlogCommentAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BlogCommentStatus | "TOUS">("TOUS");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await listBlogComments(filter === "TOUS" ? {} : { status: filter });
      setComments(data);
    } catch {
      setError("Impossible de charger les commentaires.");
    }
  }

  useEffect(() => {
    setComments(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function handleModerate(id: string, status: BlogCommentStatus) {
    setBusyId(id);
    try {
      await moderateBlogComment(id, status);
      setComments((prev) => prev?.map((c) => (c.id === id ? { ...c, status } : c)) ?? null);
    } catch {
      setError("Action impossible, réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(comment: BlogCommentAdmin) {
    if (!confirm(`Supprimer définitivement le commentaire de "${comment.pseudo}" ?`)) return;
    setBusyId(comment.id);
    try {
      await deleteBlogComment(comment.id);
      setComments((prev) => prev?.filter((c) => c.id !== comment.id) ?? null);
    } catch {
      setError("Suppression impossible, réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Commentaires du blog</h1>
          <p className="text-sm text-neutral-500">
            Modération façon Facebook : les commentaires détectés comme injurieux/spam ou signalés par des lecteurs
            sont masqués automatiquement, en attente de votre relecture.
          </p>
        </div>
        <div className="flex items-center rounded-full border border-neutral-200 p-0.5 text-sm">
          {(["TOUS", "VISIBLE", "MASQUE"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "rounded-full px-3 py-1.5 font-medium transition-colors",
                filter === value ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              {value === "TOUS" ? "Tous" : STATUS_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {!comments ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun commentaire pour ce filtre.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-900">{comment.pseudo}</span>
                  <span className="text-xs text-neutral-400">sur l&apos;article « {comment.slug} »</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      comment.status === "VISIBLE" ? "bg-primary/10 text-primary" : "bg-neutral-100 text-neutral-500"
                    )}
                  >
                    {STATUS_LABEL[comment.status]}
                  </span>
                  {comment.flag_reason && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      {FLAG_LABEL[comment.flag_reason]}
                      {comment.flag_reason === "SIGNALEMENTS" ? ` (${comment.report_count})` : ""}
                    </span>
                  )}
                </div>
                <span className="text-xs text-neutral-400">{formatDate(comment.created_at)}</span>
              </div>

              <p className="mt-2 text-sm text-neutral-700">{comment.text}</p>

              <div className="mt-3 flex items-center gap-2">
                {comment.status !== "VISIBLE" && (
                  <button
                    type="button"
                    disabled={busyId === comment.id}
                    onClick={() => handleModerate(comment.id, "VISIBLE")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                  >
                    <Check className="size-3.5" /> Approuver
                  </button>
                )}
                {comment.status !== "MASQUE" && (
                  <button
                    type="button"
                    disabled={busyId === comment.id}
                    onClick={() => handleModerate(comment.id, "MASQUE")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-amber-400 hover:text-amber-700 disabled:opacity-50"
                  >
                    <EyeOff className="size-3.5" /> Masquer
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === comment.id}
                  onClick={() => handleDelete(comment)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" /> Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
