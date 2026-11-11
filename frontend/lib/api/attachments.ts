import { apiFetch } from "@/lib/api/client";

/** Cibles autorisées côté serveur (core.attachment_views.ATTACHABLE_MODELS). */
export type AttachmentTarget = "procurement.supplierquote" | "procurement.supplierinvoice";

export interface DocumentAttachment {
  id: string;
  document_type: string;
  document_type_display: string;
  file_url: string | null;
  file_name: string;
  file_size: number;
  notes: string;
  uploaded_by_name: string | null;
  created_at: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const PATH = "/api/v1/attachments/";

export function listAttachments(target: AttachmentTarget, objectId: string) {
  const qs = new URLSearchParams({ content_type: target, object_id: objectId });
  return apiFetch<{ results: DocumentAttachment[] } | DocumentAttachment[]>(`${PATH}?${qs}`).then((res) =>
    Array.isArray(res) ? res : res.results
  );
}

/** Multipart — pas apiFetch(), qui force Content-Type: application/json. */
export async function uploadAttachment(target: AttachmentTarget, objectId: string, file: File, documentType: string) {
  const { auth } = await import("@/lib/firebase/config");
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const form = new FormData();
  form.append("content_type", target);
  form.append("object_id", objectId);
  form.append("document_type", documentType);
  form.append("file", file);
  const response = await fetch(`${API_BASE}${PATH}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!response.ok) {
    let detail = "Téléversement impossible.";
    try {
      const body = await response.json();
      detail = String(body.detail ?? body.file ?? Object.values(body)[0] ?? detail);
    } catch {
      // pas de corps JSON
    }
    throw new Error(detail);
  }
  return (await response.json()) as DocumentAttachment;
}

export function deleteAttachment(id: string) {
  return apiFetch<void>(`${PATH}${id}/`, { method: "DELETE" });
}
