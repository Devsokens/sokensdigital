import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProjectExplorer } from "@/components/projects/project-explorer";
import { ProjectsCta } from "@/components/projects/projects-cta";
import { getShowcaseProjects } from "@/lib/projects/public";

export const metadata: Metadata = {
  title: "Projects — Soken's Digital",
  description:
    "Études de cas : infrastructures haute performance, sécurité et scalabilité livrées par Soken's Digital.",
};

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
