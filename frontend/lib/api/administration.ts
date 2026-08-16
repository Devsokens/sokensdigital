import { apiFetch } from "@/lib/api/client";
import type {
  Client,
  ClientContact,
  ClientDocumentEntry,
  ClientInteractionEntry,
  Paginated,
} from "@/lib/api/types";

// The administration app was mounted without the /api/v1/ prefix used by
// every other app (backend/sokens_backend/urls.py:33) — not our
// convention to fix here, just the endpoint as it actually exists.
const BASE = "/api/administration";

export interface ClientInput {
  company_name: string;
  siret?: string;
  sector?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  status?: string;
  rating?: number | null;
  notes?: string;
  assigned_to?: string | null;
}

export function listClients(params?: { status?: string; search?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.search) query.set("search", params.search);
  const qs = query.toString();
  return apiFetch<Paginated<Client>>(`${BASE}/clients/${qs ? `?${qs}` : ""}`);
}

export function getClient(id: string) {
  return apiFetch<Client>(`${BASE}/clients/${id}/`);
}

export function createClient(data: ClientInput) {
  return apiFetch<Client>(`${BASE}/clients/`, { method: "POST", body: JSON.stringify(data) });
}

export function updateClient(id: string, data: Partial<ClientInput>) {
  return apiFetch<Client>(`${BASE}/clients/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export function archiveClient(id: string) {
  return apiFetch<{ status: string }>(`${BASE}/clients/${id}/archive/`, { method: "POST" });
}

export function listContacts(clientId: string) {
  return apiFetch<Paginated<ClientContact>>(`${BASE}/clients/${clientId}/contacts/`);
}

export function createContact(clientId: string, data: Omit<ClientContact, "id" | "client">) {
  return apiFetch<ClientContact>(`${BASE}/clients/${clientId}/contacts/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateContact(clientId: string, contactId: string, data: Partial<Omit<ClientContact, "id" | "client">>) {
  return apiFetch<ClientContact>(`${BASE}/clients/${clientId}/contacts/${contactId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteContact(clientId: string, contactId: string) {
  return apiFetch<void>(`${BASE}/clients/${clientId}/contacts/${contactId}/`, { method: "DELETE" });
}

export function listInteractions(clientId: string) {
  return apiFetch<Paginated<ClientInteractionEntry>>(`${BASE}/clients/${clientId}/interactions/`);
}

export function createInteraction(
  clientId: string,
  data: { contact?: string | null; interaction_type: string; subject: string; notes: string; follow_up_date?: string | null }
) {
  return apiFetch<ClientInteractionEntry>(`${BASE}/clients/${clientId}/interactions/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listClientDocuments(clientId: string) {
  return apiFetch<Paginated<ClientDocumentEntry>>(`${BASE}/clients/${clientId}/documents/`);
}

export function createClientDocument(
  clientId: string,
  data: { name: string; file_path: string; file_type: string; is_sensitive?: boolean }
) {
  return apiFetch<ClientDocumentEntry>(`${BASE}/clients/${clientId}/documents/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteClientDocument(clientId: string, documentId: string) {
  return apiFetch<void>(`${BASE}/clients/${clientId}/documents/${documentId}/`, { method: "DELETE" });
}
