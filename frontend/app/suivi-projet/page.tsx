import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TrackingHero } from "@/components/sections/tracking/tracking-hero";
import { ProjectStatusCard } from "@/components/sections/tracking/project-status-card";
import { TrackingFeatures } from "@/components/sections/tracking/tracking-features";
import { getPageSections, findSection } from "@/lib/api/public";

export const metadata: Metadata = {
  title: "Suivi de Projet — Soken's Digital",
  description:
    "Accédez en temps réel à l'état d'avancement de votre solution digitale sécurisée.",
};

export default async function SuiviProjetPage() {
  const sections = await getPageSections("SUIVI_PROJET");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <TrackingHero section={findSection(sections, "tracking_hero")} />
        {/* La carte lit `?t=<jeton>` pour ouvrir directement le suivi
            depuis le lien de l'e-mail. `useSearchParams` suspend au
            prérendu : sans cette limite, tout le reste de la page
            basculerait en rendu client. */}
        <Suspense fallback={<div className="min-h-64" />}>
          <ProjectStatusCard />
        </Suspense>
        <TrackingFeatures section={findSection(sections, "tracking_features")} />
      </main>
      <SiteFooter />
    </>
  );
}
