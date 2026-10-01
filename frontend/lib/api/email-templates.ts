import { apiFetch } from "@/lib/api/client";
import type { EmailTemplateEntry } from "@/lib/api/types";

export function listEmailTemplates() {
  return apiFetch<EmailTemplateEntry[]>("/api/v1/email-templates/");
}

export function saveEmailTemplate(key: string, data: { subject: string; body_html: string }) {
  return apiFetch<EmailTemplateEntry>(`/api/v1/email-templates/${key}/`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/** Supprime la personnalisation — le texte par défaut s'applique de nouveau. */
export function resetEmailTemplate(key: string) {
  return apiFetch<EmailTemplateEntry>(`/api/v1/email-templates/${key}/`, { method: "DELETE" });
}
