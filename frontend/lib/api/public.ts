import type { PageSection, PublicQuote, SitePage, SiteSettings } from "@/lib/api/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Server-side fetch (no Firebase auth — these are public, unauthenticated
 * endpoints) used by the public site's Server Components. Revalidates every
 * 60s so content edits made in /admin/marketing/blog show up without a
 * redeploy, without hitting Django on every single request. */
export async function getPageSections(page: SitePage): Promise<PageSection[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/public/cms/page-sections/?page=${page}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    return (await response.json()) as PageSection[];
  } catch {
    // Backend unreachable — the calling page falls back to its own
    // hardcoded defaults rather than breaking the public site.
    return [];
  }
}

export function findSection(sections: PageSection[], key: string) {
  return sections.find((s) => s.section_key === key) ?? null;
}

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  logo_url: "",
  tagline: "Architectes de solutions numériques haute performance. Sécurité. Précision. Innovation.",
  services_links: [
    { label: "Logiciel client" },
    { label: "App Web & Mobile" },
    { label: "Digitalisation" },
    { label: "Audit & Sécurité" },
  ],
  legal_links: [
    { label: "Politique de confidentialité", href: "#" },
    { label: "Condition d'utilisation", href: "#" },
  ],
  social_links: [
    { icon: "globe", url: "#" },
    { icon: "at-sign", url: "mailto:contact@sokensdigital.com" },
  ],
  copyright_text: "© 2024 Soken's Digital. Sécurité. Précision. Haute Performance.",
};

/** Site-wide header/footer chrome. Falls back to the site's original
 * hardcoded content if the backend is unreachable — never renders an
 * empty header/footer. */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/public/site-settings/`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return DEFAULT_SITE_SETTINGS;
    return (await response.json()) as SiteSettings;
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export interface LeadPublicInput {
  first_name: string;
  last_name: string;
  company_name?: string;
  email: string;
  phone?: string;
  source: "FORMULAIRE_CONTACT" | "FORMULAIRE_DEVIS" | "APPEL_ENTRANT" | "SITE_WEB" | "EVENEMENT";
  message?: string;
  estimated_value?: string;
}

/** Client-side call (the "Démarrer un projet" wizard runs entirely in the
 * browser) — no Firebase token, this is the public unauthenticated intake
 * endpoint. Throws on failure so the caller can show a real error instead
 * of silently pretending the submission worked. */
export async function createLead(data: LeadPublicInput): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/leads/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Trop de tentatives. Réessaie dans une minute.");
    }
    throw new Error("Impossible d'envoyer la demande. Réessaie dans un instant.");
  }
}

/** Client-side call — the quote acceptance page runs entirely in the
 * browser, no Firebase auth (the tracking_token itself is the
 * credential, cahier des charges §4.7 "portail de validation client"). */
export async function getPublicQuote(token: string): Promise<PublicQuote> {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/quotes/track/${token}/`);
  if (!response.ok) throw new Error("Ce devis est introuvable ou le lien a expiré.");
  return response.json();
}

/** `signatureDataUrl` is the signature pad's `canvas.toDataURL('image/png')`
 * output — the server decodes/uploads it and stores signature_url on the
 * quote (§4.7 e-signature). Required by the backend for a first
 * acceptance; omitted on the idempotent re-post once already ACCEPTE. */
export async function acceptPublicQuote(token: string, signatureDataUrl?: string): Promise<PublicQuote> {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/quotes/track/${token}/accept/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signatureDataUrl ? { signature: signatureDataUrl } : {}),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("Trop de tentatives. Réessaie dans une minute.");
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || "Impossible d'accepter ce devis pour l'instant.");
  }
  return response.json();
}

export interface PublicFAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
}

/** Server-side fetch — same revalidate-every-60s pattern as getSiteSettings,
 * with an empty-array fallback so the /faq page never breaks if the
 * backend is unreachable. */
export async function listPublicFAQ(): Promise<PublicFAQEntry[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/public/faq/`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return data.results ?? data;
  } catch {
    return [];
  }
}

export interface PublicTicketMessage {
  id: string;
  sender_type: "VISITEUR" | "STAFF";
  author: { id: string; first_name: string; last_name: string } | null;
  body: string;
  created_at: string;
}

export interface PublicTicket {
  id: string;
  visitor_name: string;
  subject: string;
  status: "OUVERT" | "EN_COURS" | "FERME";
  messages: PublicTicketMessage[];
  created_at: string;
}

export interface CreateTicketInput {
  visitor_name: string;
  visitor_email: string;
  subject?: string;
  message: string;
}

/** Client-side call — the support chat widget runs entirely in the
 * browser, no Firebase auth. The returned access_token is the visitor's
 * only credential to poll/reply afterwards (persisted in localStorage by
 * the widget, not here). */
export async function createSupportTicket(data: CreateTicketInput): Promise<{ id: string; access_token: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/tickets/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("Trop de tentatives. Réessaie dans une minute.");
    throw new Error("Impossible d'envoyer le message. Réessaie dans un instant.");
  }
  return response.json();
}

export async function getSupportTicket(accessToken: string): Promise<PublicTicket> {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/tickets/${accessToken}/`);
  if (!response.ok) throw new Error("Cette conversation est introuvable.");
  return response.json();
}

export async function replySupportTicket(accessToken: string, message: string): Promise<PublicTicketMessage> {
  const response = await fetch(`${API_BASE_URL}/api/v1/public/tickets/${accessToken}/reply/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("Trop de tentatives. Réessaie dans une minute.");
    throw new Error("Impossible d'envoyer le message.");
  }
  return response.json();
}
