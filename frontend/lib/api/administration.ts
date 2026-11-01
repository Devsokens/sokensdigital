import { auth } from "@/lib/firebase/config";
import { apiFetch } from "@/lib/api/client";
import type {
  Appointment,
  Client,
  ClientContact,
  ClientDocumentEntry,
  ClientInteractionEntry,
  DirectoryContact,
  Meeting,
  MeetingNote,
  Paginated,
  SentEmail,
} from "@/lib/api/types";

// The administration app was mounted without the /api/v1/ prefix used by
// every other app (backend/sokens_backend/urls.py:33) — not our
// convention to fix here, just the endpoint as it actually exists.
const BASE = "/api/administration";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

/** Tous les clients accessibles en une requête — pour les listes de choix. */
export function listAllClients() {
  return apiFetch<Paginated<Client>>(`${BASE}/clients/?page_size=500&ordering=company_name`);
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

export function listClientEmails(id: string) {
  return apiFetch<SentEmail[]>(`${BASE}/clients/${id}/emails/`);
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

// Annuaire des contacts (/contacts/) — rattachés ou non à un client.
export type DirectoryContactInput = Partial<Omit<DirectoryContact, "id" | "client_name" | "created_at">>;

export function listDirectoryContacts(params?: { client?: string; search?: string }) {
  const query = new URLSearchParams({ page_size: "500" });
  if (params?.client) query.set("client", params.client);
  if (params?.search) query.set("search", params.search);
  return apiFetch<Paginated<DirectoryContact>>(`${BASE}/contacts/?${query}`);
}

export function createDirectoryContact(data: DirectoryContactInput) {
  return apiFetch<DirectoryContact>(`${BASE}/contacts/`, { method: "POST", body: JSON.stringify(data) });
}

export function updateDirectoryContact(id: string, data: DirectoryContactInput) {
  return apiFetch<DirectoryContact>(`${BASE}/contacts/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteDirectoryContact(id: string) {
  return apiFetch<void>(`${BASE}/contacts/${id}/`, { method: "DELETE" });
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

/** Multipart, pas apiFetch() (qui force Content-Type: application/json) —
 * le fichier est envoyé directement à cet endpoint, qui fait l'upload
 * lui-même côté serveur (core.storage.upload_client_document) et retourne
 * le document avec une URL signée à la demande. Avant, le fichier était
 * uploadé à part via uploadChatFile() puis son URL signée postée comme
 * file_path — cette URL expirait en silence après 7 jours. */
export async function createClientDocument(
  clientId: string,
  file: File,
  data: { name?: string; file_type: string; is_sensitive?: boolean }
): Promise<ClientDocumentEntry> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("file_type", data.file_type);
  if (data.name) formData.append("name", data.name);
  if (data.is_sensitive) formData.append("is_sensitive", "true");

  const response = await fetch(`${API_BASE_URL}${BASE}/clients/${clientId}/documents/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) {
    let detail = `Échec de l'envoi (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      // pas de corps JSON
    }
    throw new Error(detail);
  }
  return response.json();
}

export function deleteClientDocument(clientId: string, documentId: string) {
  return apiFetch<void>(`${BASE}/clients/${clientId}/documents/${documentId}/`, { method: "DELETE" });
}

export interface AppointmentInput {
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  location?: string;
  client?: string | null;
  attendees?: string[];
}

export function listAppointments(params?: { client?: string }) {
  const query = new URLSearchParams();
  if (params?.client) query.set("client", params.client);
  const qs = query.toString();
  return apiFetch<Paginated<Appointment>>(`${BASE}/appointments/${qs ? `?${qs}` : ""}`);
}

export function createAppointment(data: AppointmentInput) {
  return apiFetch<Appointment>(`${BASE}/appointments/`, { method: "POST", body: JSON.stringify(data) });
}

export function updateAppointment(id: string, data: Partial<AppointmentInput>) {
  return apiFetch<Appointment>(`${BASE}/appointments/${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteAppointment(id: string) {
  return apiFetch<void>(`${BASE}/appointments/${id}/`, { method: "DELETE" });
}

/** Crée la réunion à la demande au premier appel (OneToOne sur le rendez-vous). */
export function getMeeting(appointmentId: string) {
  return apiFetch<Meeting>(`${BASE}/appointments/${appointmentId}/meeting/`);
}

export function updateMeeting(appointmentId: string, data: Partial<{ agenda_items: string[]; minutes_summary: string }>) {
  return apiFetch<Meeting>(`${BASE}/appointments/${appointmentId}/meeting/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function getMyMeetingNote(appointmentId: string) {
  return apiFetch<MeetingNote>(`${BASE}/appointments/${appointmentId}/meeting/my-note/`);
}

export function updateMyMeetingNote(appointmentId: string, body: string) {
  return apiFetch<MeetingNote>(`${BASE}/appointments/${appointmentId}/meeting/my-note/`, {
    method: "PUT",
    body: JSON.stringify({ body }),
  });
}
