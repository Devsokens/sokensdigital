import { apiFetch } from "@/lib/api/client";
import type { Paginated } from "@/lib/api/types";

/* Abonnements de services (backend : app `services`) — communication
 * digitale (Marketing) et maintenance & hébergement (Technique), adossés
 * aux devis / factures / paiements existants. */

const BASE = "/api/v1/services";

export type ServicePole = "COMMUNICATION" | "MAINTENANCE";
export type OfferKind = "MENSUEL" | "ANNUEL" | "PONCTUEL";
export type Quotas = Record<string, number>;

export const POLE_LABELS: Record<ServicePole, string> = {
  COMMUNICATION: "Communication digitale",
  MAINTENANCE: "Maintenance & hébergement",
};

export const QUOTA_LABELS: Record<string, string> = {
  reseaux: "réseaux sociaux",
  publications: "publications",
  videos: "vidéos courtes",
  campagnes: "campagnes pub",
  heures_modif: "h de modifications",
};

export const KIND_LABELS: Record<OfferKind, string> = {
  MENSUEL: "Mensuel",
  ANNUEL: "Annuel",
  PONCTUEL: "Ponctuel",
};

export interface ServiceOffer {
  id: string;
  code: string;
  name: string;
  pole: ServicePole;
  kind: OfferKind;
  price_ttc: string;
  quotas: Quotas;
  response_sla_hours: number | null;
  requires_meeting: boolean;
  features: string;
  is_active: boolean;
  sort_order: number;
}

export type SubscriptionStatus = "ACTIVE" | "SUSPENDU" | "RESILIE";
export type PeriodStatus = "EN_ATTENTE_PAIEMENT" | "OUVERT" | "CLOTURE";
export type DeliverableStatus = "BROUILLON" | "CONTROLE_INTERNE" | "VALIDE_CLIENT" | "PUBLIE" | "LIVRE";
export type DeliverableKind =
  | "PUBLICATION" | "VIDEO" | "CAMPAGNE" | "VISUEL" | "MESSAGES" | "EVENEMENT" | "MODIFICATION_HEURES" | "INTERVENTION";

export const DELIVERABLE_KIND_LABELS: Record<DeliverableKind, string> = {
  PUBLICATION: "Publication",
  VIDEO: "Vidéo courte (≤ 60 s)",
  CAMPAGNE: "Campagne sponsorisée",
  VISUEL: "Visuel",
  MESSAGES: "Gestion des messages",
  EVENEMENT: "Couverture d'événement",
  MODIFICATION_HEURES: "Heures de modification",
  INTERVENTION: "Intervention",
};

export const KINDS_BY_POLE: Record<ServicePole, DeliverableKind[]> = {
  COMMUNICATION: ["PUBLICATION", "VIDEO", "CAMPAGNE", "VISUEL", "MESSAGES", "EVENEMENT"],
  MAINTENANCE: ["MODIFICATION_HEURES", "INTERVENTION"],
};

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  BROUILLON: "Brouillon",
  CONTROLE_INTERNE: "Contrôle interne",
  VALIDE_CLIENT: "Validé client",
  PUBLIE: "Publié",
  LIVRE: "Livré",
};

export const PERIOD_STATUS_LABELS: Record<PeriodStatus, string> = {
  EN_ATTENTE_PAIEMENT: "En attente de paiement",
  OUVERT: "Ouvert",
  CLOTURE: "Clôturé",
};

export interface Deliverable {
  id: string;
  period: string | null;
  ponctual_invoice: string | null;
  kind: DeliverableKind;
  quantity: string;
  title: string;
  network: string;
  status: DeliverableStatus;
  assigned_to: string | null;
  assigned_to_name: string | null;
  published_at: string | null;
  proof_url: string;
  created_at: string;
}

export interface ServicePeriod {
  id: string;
  subscription: string;
  period_start: string;
  period_end: string;
  status: PeriodStatus;
  invoice: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  invoice_amount_ttc: string | null;
  invoice_amount_paid: string | null;
  quotas_alloues: Quotas;
  consumed: Quotas;
  remaining: Quotas;
  carry_over: { carried?: Quotas; reason?: string };
  opened_at: string | null;
  report_url: string;
  report_notes: string;
  meeting_held: boolean;
  closed_at: string | null;
  deliverables: Deliverable[];
}

export interface Subscription {
  id: string;
  client: string;
  client_name: string;
  offer: string;
  offer_name: string;
  pole: ServicePole;
  kind: OfferKind;
  quote: string | null;
  quote_number: string | null;
  maintained_app: string | null;
  maintained_app_name: string | null;
  status: SubscriptionStatus;
  start_date: string;
  networks: string[];
  custom_quotas: Quotas;
  custom_price_ttc: string | null;
  price: string;
  quotas: Quotas;
  account_manager: string | null;
  account_manager_name: string | null;
  notes: string;
  current_period: {
    id: string; status: PeriodStatus; period_start: string; period_end: string;
    quotas_alloues: Quotas; consumed: Quotas;
  } | null;
  created_at: string;
}

export interface DashboardRow {
  period: string;
  subscription: string;
  client: string;
  offer: string;
  pole: ServicePole;
  period_start: string;
  period_end: string;
  invoice_number?: string | null;
  ratio?: number | null;
  elapsed?: number;
}

export interface ServicesDashboard {
  active_count: number;
  mrr: Partial<Record<ServicePole, string>>;
  unpaid_started: DashboardRow[];
  consumption: DashboardRow[];
  pace_alerts: DashboardRow[];
  unclosed_overdue: DashboardRow[];
  renewals_due: { subscription: string; client: string; offer: string; period_end: string }[];
  sla_overdue: { ticket: string; title: string; client: string; sla_hours: number; created_at: string }[];
}

const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const listOffers = (pole?: ServicePole, activeOnly = false) => {
  const q = new URLSearchParams();
  if (pole) q.set("pole", pole);
  if (activeOnly) q.set("active", "1");
  q.set("page_size", "100");
  return apiFetch<Paginated<ServiceOffer>>(`${BASE}/offers/?${q}`);
};
export const createOffer = (data: Partial<ServiceOffer>) => apiFetch<ServiceOffer>(`${BASE}/offers/`, json(data));
export const updateOffer = (id: string, data: Partial<ServiceOffer>) =>
  apiFetch<ServiceOffer>(`${BASE}/offers/${id}/`, json(data, "PATCH"));

export const listSubscriptions = (pole?: ServicePole) =>
  apiFetch<Paginated<Subscription>>(`${BASE}/subscriptions/?page_size=200${pole ? `&pole=${pole}` : ""}`);
export const getSubscription = (id: string) => apiFetch<Subscription>(`${BASE}/subscriptions/${id}/`);
export const createSubscription = (data: Partial<Subscription>) =>
  apiFetch<Subscription>(`${BASE}/subscriptions/`, json(data));
export const updateSubscription = (id: string, data: Partial<Subscription>) =>
  apiFetch<Subscription>(`${BASE}/subscriptions/${id}/`, json(data, "PATCH"));
export const listPeriods = (id: string) => apiFetch<ServicePeriod[]>(`${BASE}/subscriptions/${id}/periods/`);
export const generateInvoice = (id: string) =>
  apiFetch<ServicePeriod>(`${BASE}/subscriptions/${id}/generate-invoice/`, json({}));

export const closePeriod = (
  id: string,
  data: { report_url?: string; report_notes?: string; meeting_held?: boolean; carry_over?: Quotas; carry_reason?: string },
) => apiFetch<ServicePeriod>(`${BASE}/periods/${id}/close/`, json(data));

export const createDeliverable = (data: Partial<Deliverable>) =>
  apiFetch<Deliverable>(`${BASE}/deliverables/`, json(data));
export const deleteDeliverable = (id: string) =>
  apiFetch<void>(`${BASE}/deliverables/${id}/`, { method: "DELETE" });
export const transitionDeliverable = (id: string, status: DeliverableStatus, proof_url?: string) =>
  apiFetch<Deliverable>(`${BASE}/deliverables/${id}/transition/`, json({ status, proof_url }));

export const getServicesDashboard = (pole?: ServicePole) =>
  apiFetch<ServicesDashboard>(`${BASE}/dashboard/${pole ? `?pole=${pole}` : ""}`);

/** Message d'erreur lisible renvoyé par l'API (champ `detail` ou 1re erreur de champ). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const body = (err as { body?: unknown })?.body;
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.detail === "string") return b.detail;
    const first = Object.values(b)[0];
    if (Array.isArray(first) && typeof first[0] === "string") return first[0];
    if (typeof first === "string") return first;
  }
  return fallback;
}

export const formatFcfa = (v: string | number | null | undefined) =>
  v == null ? "—" : `${Math.round(Number(v)).toLocaleString("fr-FR")} F`;
