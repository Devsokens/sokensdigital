"use client";

import { useEffect } from "react";
import { subscribeToConsentChanges, syncAnalyticsWithConsent } from "@/lib/analytics/posthog";

/** Monté une fois dans le layout racine. Ne rend rien : il aligne PostHog
 * sur le consentement au chargement, puis à chaque changement de choix dans
 * le bandeau cookies. Le chargement du SDK est différé après l'hydratation
 * (useEffect) pour ne rien coûter au premier affichage. */
export function PostHogProvider() {
  useEffect(() => {
    void syncAnalyticsWithConsent();
    return subscribeToConsentChanges();
  }, []);

  return null;
}
