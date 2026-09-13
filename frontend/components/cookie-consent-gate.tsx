"use client";

import { usePathname } from "next/navigation";
import { CookieConsentBanner } from "@/components/cookie-consent-banner";

/** Garde le bandeau cookies hors de l'espace admin — même raisonnement que
 * PublicChatWidgetGate : c'est un visiteur public qui doit choisir, pas le
 * personnel déjà authentifié. */
export function CookieConsentGate() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;
  return <CookieConsentBanner />;
}
