"use client";

import { useEffect, useState } from "react";
import { Flag, Loader2, Send } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { getBlogComments, postBlogComment, reportBlogComment, type PublicBlogComment } from "@/lib/api/blog-interactions";

const PSEUDO_STORAGE_KEY = "blog-comment-pseudo";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Commentaires publics façon Facebook : pseudo libre (pas de compte),
 * modérés côté back-office par le département Marketing & Communication
 * (voir components/admin/marketing/comment-moderation.tsx). Un commentaire
 * jugé problématique par le filtre automatique n'apparaît jamais ici tant
 * qu'un modérateur ne l'a pas approuvé — d'où le message "en attente"
 * plutôt qu'un ajout optimiste à la liste. */
export function CommentsSection({ slug }: { slug: string }) {
  const [comments, setComments] = useState<PublicBlogComment[] | null>(null);
  const [pseudo, setPseudo] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "pending" | "error"; message: string } | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getBlogComments(slug)
      .then(setComments)
      .catch(() => setComments([]));
    try {
      setPseudo(localStorage.getItem(PSEUDO_STORAGE_KEY) ?? "");
    } catch {
      // pas bloquant
    }
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const result = await postBlogComment(slug, pseudo.trim(), text.trim());
      try {
        localStorage.setItem(PSEUDO_STORAGE_KEY, pseudo.trim());
      } catch {
        // pas bloquant
      }
      if ("pending" in result && result.pending) {
        setFeedback({ type: "pending", message: "Commentaire envoyé, en attente de validation par notre équipe." });
      } else {
        setComments((prev) => [result as PublicBlogComment, ...(prev ?? [])]);
      }
      setText("");
    } catch (err) {
      const message =
        err instanceof ApiError && typeof err.body === "object" && err.body && "detail" in err.body
          ? String((err.body as { detail?: string }).detail)
          : "Impossible d'envoyer le commentaire, réessayez.";
      setFeedback({ type: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReport(id: string) {
    if (reportedIds.has(id)) return;
    setReportedIds((prev) => new Set(prev).add(id));
    try {
      await reportBlogComment(slug, id);
    } catch {
      // Le signalement est un geste discret côté visiteur — pas de retry
      // agressif, l'état "signalé" reste affiché même si l'appel a échoué.
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground">Commentaires{comments ? ` (${comments.length})` : ""}</h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-card/60 p-5">
        <input
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          placeholder="Votre pseudo"
          maxLength={40}
          required
          minLength={2}
          className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
        />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Votre commentaire…"
          maxLength={1000}
          required
          minLength={2}
          rows={3}
          className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
        />
        <div className="flex items-center justify-between">
          {feedback ? (
            <p className={feedback.type === "pending" ? "text-xs text-primary" : "text-xs text-destructive"}>
              {feedback.message}
            </p>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Publier
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {comments === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Soyez le premier à commenter cet article.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-white/10 bg-card/40 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-foreground">{comment.pseudo}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleReport(comment.id)}
                  disabled={reportedIds.has(comment.id)}
                  aria-label="Signaler ce commentaire"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:text-destructive/70"
                >
                  <Flag className="size-3" />
                  {reportedIds.has(comment.id) ? "Signalé" : "Signaler"}
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{comment.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
