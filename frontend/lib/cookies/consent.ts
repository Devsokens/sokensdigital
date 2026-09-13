/** Gestion du consentement cookies (bandeau RGPD, décision du 13/09/2026).
 *
 * Trois catégories : `necessaire` (toujours actif, pas de choix possible —
 * session, préférences d'affichage, rien qui dépose un traceur tiers),
 * `analytique` (mesure d'audience) et `marketing` (pixels publicitaires).
 * Rien de ces deux dernières n'est câblé aujourd'hui (aucun script Google
 * Analytics/Facebook Pixel dans le repo) — ce module existe pour que
 * l'obligation légale soit respectée dès maintenant, et pour que le jour où
 * un tel script est ajouté, il n'ait qu'à appeler `hasConsent()` avant de se
 * charger plutôt que redéfinir tout le mécanisme de consentement.
 */

export type CookieCategory = "analytique" | "marketing";

export interface CookieConsent {
  analytique: boolean;
  marketing: boolean;
  /** Horodatage ISO du choix — utile si on doit un jour redemander le
   * consentement après un délai (13 mois, recommandation CNIL). */
  decidedAt: string;
}

const STORAGE_KEY = "sokens-cookie-consent";
/** Nom de l'événement custom émis à chaque changement — permet à un script
 * tiers (ou à un autre composant React) de réagir sans polling ni prop
 * drilling depuis la racine. */
export const CONSENT_CHANGED_EVENT = "sokens-cookie-consent-changed";

export function getConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsent;
  } catch {
    // Stockage indisponible (navigation privée stricte) ou JSON corrompu —
    // traité comme "pas encore de choix", le bandeau se réaffiche.
    return null;
  }
}

export function setConsent(partial: { analytique: boolean; marketing: boolean }): void {
  if (typeof window === "undefined") return;
  const consent: CookieConsent = { ...partial, decidedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch {
    // Rien à faire de plus : le bandeau réapparaîtra à la prochaine visite,
    // ce n'est pas pire que ne jamais avoir pu enregistrer le choix.
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
}

export function hasConsent(category: CookieCategory): boolean {
  return getConsent()?.[category] ?? false;
}

export function acceptAll(): void {
  setConsent({ analytique: true, marketing: true });
}

export function refuseAll(): void {
  setConsent({ analytique: false, marketing: false });
}
