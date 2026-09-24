import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ExpertiseHero } from "@/components/sections/expertise/expertise-hero";
import { StrategicAdvantages } from "@/components/sections/expertise/strategic-advantages";
import { ProcessTimeline } from "@/components/sections/expertise/process-timeline";
import { TechStack } from "@/components/sections/expertise/tech-stack";
import { FeaturedCaseStudy } from "@/components/sections/expertise/featured-case-study";
import { getPageSections, findSection } from "@/lib/api/public";
import { getShowcaseProjects } from "@/lib/projects/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Expertise : développement web, mobile, cloud et cybersécurité",
  description:
    "Développement d'applications web et mobiles, logiciels sur mesure, cloud et cybersécurité à Libreville (Gabon) : une expertise technique au service des entreprises africaines.",
  path: "/expertise",
  keywords: ["développement sur mesure Gabon", "cybersécurité Afrique", "cloud Libreville"],
});

export default async function ExpertisePage() {
  const [sections, projects] = await Promise.all([
    getPageSections("EXPERTISE"),
    getShowcaseProjects(),
  ]);
  const featuredProject = projects.find((p) => p.featured) ?? null;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ExpertiseHero section={findSection(sections, "expertise_hero")} />
        <StrategicAdvantages section={findSection(sections, "strategic_advantages")} />
        <ProcessTimeline section={findSection(sections, "process_timeline")} />
        <TechStack section={findSection(sections, "tech_stack")} />
        <FeaturedCaseStudy section={findSection(sections, "featured_case_study")} featuredProject={featuredProject} />
      </main>
      <SiteFooter />
    </>
  );
}
