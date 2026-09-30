import { apiFetch } from "@/lib/api/client";

/** Le profil Django complet de la personne connectée — c'est ici, pas dans
 * le profil Firestore, que vit `permission_overrides` (surcharge des
 * permissions propre à cette personne, voir
 * lib/admin/permissions-context.tsx). */
export function getMe() {
  return apiFetch<{ id: string; permission_overrides: Record<string, string[]> }>(
    "/api/v1/auth/me/"
  );
}

/** Keeps the Django-side User row (core_user.first_name/last_name/avatar_url)
 * in sync with the Firestore profile doc — the REST API's own serializers
 * (project members, task assignees, timesheet entries...) read from Django,
 * not Firestore, so both need the same values after a self-edit. */
export function updateMe(data: Partial<{ first_name: string; last_name: string; avatar_url: string | null }>) {
  return apiFetch<{ id: string; first_name: string; last_name: string; avatar_url: string | null }>(
    "/api/v1/auth/me/",
    { method: "PATCH", body: JSON.stringify(data) }
  );
}
