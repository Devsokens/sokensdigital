import { apiFetch } from "@/lib/api/client";
import type { FAQEntry, Paginated, SupportTicket, SupportTicketListItem, TicketMessage } from "@/lib/api/types";

export interface FAQInput {
  question: string;
  answer: string;
  category?: string;
  audience?: "PUBLIC" | "INTERNE";
  order?: number;
  is_published?: boolean;
}

export function listFAQ() {
  return apiFetch<Paginated<FAQEntry>>("/api/v1/support/faq/");
}

export function createFAQ(data: FAQInput) {
  return apiFetch<FAQEntry>("/api/v1/support/faq/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateFAQ(id: string, data: Partial<FAQInput>) {
  return apiFetch<FAQEntry>(`/api/v1/support/faq/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteFAQ(id: string) {
  return apiFetch<void>(`/api/v1/support/faq/${id}/`, { method: "DELETE" });
}

export function listTickets() {
  return apiFetch<Paginated<SupportTicketListItem>>("/api/v1/support/tickets/");
}

export function getTicket(id: string) {
  return apiFetch<SupportTicket>(`/api/v1/support/tickets/${id}/`);
}

export function updateTicket(id: string, data: { status?: string; assigned_to_id?: string | null }) {
  return apiFetch<SupportTicket>(`/api/v1/support/tickets/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function replyTicket(id: string, message: string) {
  return apiFetch<TicketMessage>(`/api/v1/support/tickets/${id}/reply/`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
