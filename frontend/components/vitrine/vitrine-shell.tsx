import type { ReactNode } from "react";
import { getSiteSettings } from "@/lib/api/public";
import { VitrineFrame, type VitrinePage } from "./vitrine-frame";

/** Coquille des pages vitrine du site public : charge les paramètres du
 * site (logo, coordonnées, pied de page) puis rend le cadre commun. */
export async function VitrineShell({ page, children }: { page: VitrinePage; children: ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <VitrineFrame page={page} settings={settings}>
      {children}
    </VitrineFrame>
  );
}
