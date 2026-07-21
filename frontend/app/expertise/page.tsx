import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ExpertiseHero } from "@/components/sections/expertise/expertise-hero";
import { StrategicAdvantages } from "@/components/sections/expertise/strategic-advantages";
import { ProcessTimeline } from "@/components/sections/expertise/process-timeline";
import { TechStack } from "@/components/sections/expertise/tech-stack";
import { FeaturedCaseStudy } from "@/components/sections/expertise/featured-case-study";
import { getPageSections, findSection } from "@/lib/api/public";

export const metadata: Metadata = {
  title: "Expertise — Soken's Digital",
  description:
    "Solutions digitales sur mesure : sécurité native, performance critique et scalabilité infinie pour les leaders de demain.",
};

export default async function ExpertisePage() {
  const sections = await getPageSections("EXPERTISE");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ExpertiseHero section={findSection(sections, "expertise_hero")} />
        <StrategicAdvantages section={findSection(sections, "strategic_advantages")} />
        <ProcessTimeline section={findSection(sections, "process_timeline")} />
        <TechStack section={findSection(sections, "tech_stack")} />
        <FeaturedCaseStudy section={findSection(sections, "featured_case_study")} />
      </main>
      <SiteFooter />
    </>
  );
}
