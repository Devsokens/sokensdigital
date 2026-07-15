import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ExpertiseHero } from "@/components/sections/expertise/expertise-hero";
import { StrategicAdvantages } from "@/components/sections/expertise/strategic-advantages";
import { ProcessTimeline } from "@/components/sections/expertise/process-timeline";
import { TechStack } from "@/components/sections/expertise/tech-stack";
import { FeaturedCaseStudy } from "@/components/sections/expertise/featured-case-study";

export const metadata: Metadata = {
  title: "Expertise — Soken's Digital",
  description:
    "Solutions digitales sur mesure : sécurité native, performance critique et scalabilité infinie pour les leaders de demain.",
};

export default function ExpertisePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ExpertiseHero />
        <StrategicAdvantages />
        <ProcessTimeline />
        <TechStack />
        <FeaturedCaseStudy />
      </main>
      <SiteFooter />
    </>
  );
}
