import { apiFetch } from "@/lib/api/client";

/* Contrats de prestation de services (backend : marketing.ServiceContract). */

export type ContractStatus = "BROUILLON" | "ENVOYE" | "SIGNE";
export type ContractWatermark = "BALANCE" | "IMAGE" | "AUCUN";

export interface ContractScheduleTerm {
  label: string;
  percentage: number;
}

/** Champs modifiables d'un contrat (formulaire, aperçu, PDF). */
export interface ServiceContractFields {
  client: string | null;
  quote: string | null;
  client_name: string;
  client_legal_form: string;
  client_address: string;
  client_rccm: string;
  client_nif: string;
  client_representative: string;
  client_email: string;
  preamble: string;
  services_description: string;
  start_date: string | null;
  duration: string;
  renewal: "TERME" | "RENOUVELABLE";
  renewal_notice_days: number;
  amount: string;
  amount_basis: "HT" | "TTC";
  payment_schedule: ContractScheduleTerm[];
  first_payment_days: number;
  payment_methods: string;
  late_penalty_rate: string;
  expenses_covered: boolean;
  expenses_threshold: string | null;
  confidentiality_years: number;
  liability_cap: string;
  insurance: string;
  annex_specifications: string;
  annex_pricing: string;
  signing_date: string | null;
  client_signatory: string;
  provider_signatory: string;
  document_color: string;
  show_header: boolean;
}

export interface ServiceContract extends ServiceContractFields {
  id: string;
  contract_number: string;
  status: ContractStatus;
  quote_number: string | null;
  created_by_name: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractSettings {
  provider_identity: string;
  provider_signatory: string;
  city: string;
  watermark: ContractWatermark;
  watermark_url: string;
  watermark_opacity: number;
  apply_stamp: boolean;
}

/** Paramètres du contrat + coordonnées et cachet des paramètres des documents. */
export interface ContractDocumentSettings extends ContractSettings {
  company_address: string;
  company_email: string;
  company_stamp_url: string;
}

export interface ContractEditorQuote {
  id: string;
  quote_number: string;
  client_name: string;
  client_email: string;
  client_id: string | null;
  subject: string;
  description: string;
  project_duration: string;
  lines: { service_title: string; description: string }[];
  total_ht: string;
  payment_terms: ContractScheduleTerm[];
  document_color: string;
}

export interface ContractEditorClient {
  id: string;
  company_name: string;
  address: string;
  email: string;
}

export interface ContractEditorContext {
  settings: ContractDocumentSettings;
  quote_amount_basis: "HT" | "TTC";
  quotes: ContractEditorQuote[];
  clients: ContractEditorClient[];
}

const BASE = "/api/v1/marketing/contracts/";

export function listServiceContracts() {
  return apiFetch<ServiceContract[]>(BASE);
}

export function getServiceContract(id: string) {
  return apiFetch<ServiceContract>(`${BASE}${id}/`);
}

export function createServiceContract(data: Partial<ServiceContractFields>) {
  return apiFetch<ServiceContract>(BASE, { method: "POST", body: JSON.stringify(data) });
}

export function updateServiceContract(id: string, data: Partial<ServiceContractFields & { status: ContractStatus }>) {
  return apiFetch<ServiceContract>(`${BASE}${id}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteServiceContract(id: string) {
  return apiFetch<void>(`${BASE}${id}/`, { method: "DELETE" });
}

export function getContractEditorContext() {
  return apiFetch<ContractEditorContext>(`${BASE}editor-context/`);
}

export function sendServiceContract(id: string, options: { recipient_emails: string[]; message?: string }) {
  return apiFetch<ServiceContract & { email_warning?: string }>(`${BASE}${id}/send/`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export function getContractSettings() {
  return apiFetch<ContractSettings>("/api/v1/marketing/contract-settings/");
}

export function updateContractSettings(data: Partial<ContractSettings>) {
  return apiFetch<ContractSettings>("/api/v1/marketing/contract-settings/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function downloadServiceContractPdf(id: string, number: string) {
  const { auth } = await import("@/lib/firebase/config");
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const response = await fetch(`${base}${BASE}${id}/pdf/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.detail ?? "";
    } catch {
      // réponse non JSON
    }
    throw new Error(detail || `Téléchargement du PDF impossible (erreur ${response.status}).`);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `Contrat-${number}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
