import type { Metadata } from "next";
import { VitrineShell } from "@/components/vitrine/vitrine-shell";
import { ProjectsView } from "@/components/vitrine/projects-page";
import { getPageSections } from "@/lib/api/public";
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
  const [sections, projects] = await Promise.all([getPageSections("PROJETS"), getShowcaseProjects()]);
  return (
    <VitrineShell page="projets">
      <ProjectsView sections={sections} projects={projects} />
    </VitrineShell>
  );
}
