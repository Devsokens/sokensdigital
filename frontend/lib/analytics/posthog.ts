/** Collecte comportementale PostHog — décision du 14/09/2026.
 *
 * Trois garde-fous, dans cet ordre :
 *
 * 1. **Consentement.** Rien n'est chargé ni envoyé tant que la catégorie
 *    « analytique » n'a pas été acceptée dans le bandeau cookies
 *    (lib/cookies/consent.ts). Le SDK n'est même pas téléchargé avant : il
 *    est importé dynamiquement au moment du consentement, ce qui garde aussi
 *    ~60 Ko hors du bundle initial de chaque page publique.
 * 2. **Premier parti.** Les envois passent par `/ingest` (réécriture Next.js
 *    vers PostHog, voir next.config.ts) : pas de domaine tiers dans le
 *    navigateur, donc rien à ouvrir dans la CSP, et pas de perte de données
 *    sur les bloqueurs qui filtrent les domaines d'analytics connus.
 * 3. **Nettoyage avant envoi.** Les URLs de ce site transportent de vrais
 *    secrets : `/devis/<jeton>` (le jeton EST l'authentification du portail
 *    de signature) et `?t=<jeton>` (lien de suivi de demande). `before_send`
 *    les remplace avant qu'ils quittent le navigateur, et écarte tout
 *    événement de l'espace admin — on mesure les visiteurs, pas le personnel.
 */

import type { PostHog } from "posthog-js";
import { CONSENT_CHANGED_EVENT, hasConsent } from "@/lib/cookies/consent";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? "https://eu.posthog.com";

let client: PostHog | null = null;
let loading: Promise<PostHog | null> | null = null;

const TOKEN_PATH = /\/devis\/[^/?#]+/g;
const TOKEN_QUERY = /([?&])(t|token)=[^&#]*/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Exportée pour les tests : c'est la frontière de confidentialité. */
export function scrubUrl(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value
    .replace(TOKEN_PATH, "/devis/[jeton]")
    .replace(TOKEN_QUERY, "$1$2=[jeton]")
    .replace(EMAIL, "[email]");
}

const URL_PROPERTIES = [
  "$current_url",
  "$pathname",
  "$referrer",
  "$initial_current_url",
  "$initial_referrer",
  "$prev_pageview_pathname",
];

type CaptureEvent = { event: string; properties?: Record<string, unknown> } | null;

export function sanitizeEvent(event: CaptureEvent): CaptureEvent {
  if (!event) return event;
  const props = event.properties ?? {};
  const pathname = typeof props.$pathname === "string" ? props.$pathname : "";
  if (pathname.startsWith("/admin")) return null;

  for (const key of URL_PROPERTIES) {
    if (key in props) props[key] = scrubUrl(props[key]);
  }
  // Autocapture : le texte d'un élément cliqué peut contenir une adresse saisie.
  if (typeof props.$el_text === "string") props.$el_text = scrubUrl(props.$el_text);
  event.properties = props;
  return event;
}

function isAdminRoute(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/admin");
}

async function load(): Promise<PostHog | null> {
  if (client) return client;
  if (loading) return loading;
  if (!POSTHOG_KEY || typeof window === "undefined") return null;

  loading = import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY, {
        api_host: "/ingest",
        ui_host: POSTHOG_UI_HOST,
        // Pas de profil de personne pour un visiteur anonyme : moins de
        // stockage côté PostHog, et aucun identifiant durable inutile.
        person_profiles: "identified_only",
        // App Router : les navigations sont des changements d'historique.
        capture_pageview: "history_change",
        capture_pageleave: true,
        autocapture: true,
        capture_exceptions: true,
        capture_performance: { web_vitals: true },
        respect_dnt: true,
        // Relecture de session : saisies masquées d'office. Le SDK ne
        // télécharge l'enregistreur que si la relecture est activée pour
        // le projet dans PostHog — coût nul sinon.
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: "[data-ph-mask]",
        },
        before_send: (event) => sanitizeEvent(event as CaptureEvent) as never,
        loaded: (instance) => {
          if (process.env.NODE_ENV !== "production") instance.debug(false);
        },
      });
      client = posthog;
      return posthog;
    })
    .catch(() => {
      // Réseau coupé, module bloqué : l'analytique ne doit jamais casser le site.
      loading = null;
      return null;
    });

  return loading;
}

/** Applique l'état de consentement courant : charge et active si accepté,
 * coupe la collecte (et la relecture) si refusé ou retiré. */
export async function syncAnalyticsWithConsent(): Promise<void> {
  if (isAdminRoute()) return;

  if (hasConsent("analytique")) {
    const instance = await load();
    if (instance?.has_opted_out_capturing()) instance.opt_in_capturing();
    return;
  }

  // Consentement retiré : on ne télécharge rien s'il n'a jamais été chargé.
  if (client) {
    client.opt_out_capturing();
    client.stopSessionRecording();
  }
}

/** Événement métier. Silencieux sans consentement — jamais mis en file
 * pour être envoyé plus tard, ce qui reviendrait à collecter sans accord. */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!client || !hasConsent("analytique")) return;
  client.capture(event, properties);
}

export function subscribeToConsentChanges(): () => void {
  const handler = () => {
    void syncAnalyticsWithConsent();
  };
  window.addEventListener(CONSENT_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CONSENT_CHANGED_EVENT, handler);
}
