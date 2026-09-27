import { apiFetch } from "@/lib/api/client";

/** Appels publics (pas de compte requis) pour les likes/commentaires d'un
 * article de blog. Les commentaires sont stockés dans Firestore côté
 * backend (pas Postgres) — voir backend/marketing/views.py et
 * core/firestore_client.py ; apiFetch fonctionne sans session Firebase
 * (aucun header Authorization n'est ajouté si personne n'est connecté). */

export interface PublicBlogComment {
  id: string;
  pseudo: string;
  text: string;
  created_at: string | null;
}

export function getBlogLikeCount(slug: string) {
  return apiFetch<{ like_count: number }>(`/api/v1/public/cms/blog/${slug}/like/`);
}

export function setBlogLiked(slug: string, liked: boolean) {
  return apiFetch<{ like_count: number }>(`/api/v1/public/cms/blog/${slug}/like/`, {
    method: "POST",
    body: JSON.stringify({ liked }),
  });
}

export function getBlogComments(slug: string) {
  return apiFetch<PublicBlogComment[]>(`/api/v1/public/cms/blog/${slug}/comments/`);
}

/** Peut renvoyer soit un commentaire publié (201), soit `{ pending: true }`
 * si le filtre automatique l'a mis en file d'attente de modération (202) —
 * apiFetch traite les deux comme un succès (2xx), au consommateur de
 * distinguer via la présence de `pending`. */
export function postBlogComment(slug: string, pseudo: string, text: string) {
  return apiFetch<PublicBlogComment | { pending: true; detail: string }>(
    `/api/v1/public/cms/blog/${slug}/comments/`,
    { method: "POST", body: JSON.stringify({ pseudo, text }) },
  );
}

export function reportBlogComment(slug: string, commentId: string) {
  return apiFetch<{ report_count: number }>(`/api/v1/public/cms/blog/${slug}/comments/${commentId}/report/`, {
    method: "POST",
  });
}
