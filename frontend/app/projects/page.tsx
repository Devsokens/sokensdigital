import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProjectExplorer } from "@/components/projects/project-explorer";
import { ProjectsCta } from "@/components/projects/projects-cta";
import { getShowcaseProjects } from "@/lib/projects/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Projets et études de cas",
  description:
    "Études de cas Soken's Digital : applications, plateformes et infrastructures sécurisées livrées pour des entreprises au Gabon et en Afrique.",
  path: "/projects",
  keywords: ["réalisations agence digitale Gabon", "portfolio développement Afrique"],
});

export default async function ProjectsIndexPage() {
  const projects = await getShowcaseProjects();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ProjectExplorer projects={projects} />
        <ProjectsCta />
      </main>
      <SiteFooter />
    </>
  );
}
