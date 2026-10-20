import type { ReactNode } from "react";
import type { SiteSettings } from "@/lib/api/types";
import { vitrineRootClass } from "./fonts";
import { VitrineFooter } from "./site-footer";
import { VitrineHeader } from "./site-header";
import { FONT_SANS, contactInfo } from "./ui";

export type VitrinePage = "accueil" | "expertise" | "projets" | "blog" | "contact";

/** Cadre d'une page vitrine (en-tête, contenu, pied de page), sans chargement
 * de données : utilisé par VitrineShell sur le site public et par l'éditeur
 * visuel de l'admin. `page` active les variantes d'effets propres à certaines
 * pages (cartes spotlight de Projets et Blog) ; `previewPath` force le lien
 * actif de la navigation dans l'éditeur. */
export function VitrineFrame({ page, settings, previewPath, children }: { page: VitrinePage; settings: SiteSettings; previewPath?: string; children: ReactNode }) {
  return (
    <div className={`${vitrineRootClass} sd-page-${page}`} style={{ position: "relative", overflowX: "clip", background: "oklch(var(--sd-bg))", color: "oklch(var(--sd-fg))", fontFamily: FONT_SANS, fontSize: "16px", lineHeight: 1.6, WebkitFontSmoothing: "antialiased" }}>
      <VitrineHeader logoUrl={settings.logo_url} phone={contactInfo(settings).phone} previewPath={previewPath} />
      <main>{children}</main>
      <VitrineFooter settings={settings} />
    </div>
  );
}
