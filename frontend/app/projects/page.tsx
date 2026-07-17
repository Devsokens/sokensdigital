import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProjectExplorer } from "@/components/projects/project-explorer";
import { ProjectsCta } from "@/components/projects/projects-cta";

export const metadata: Metadata = {
  title: "Projects — Soken's Digital",
  description:
    "Études de cas : infrastructures haute performance, sécurité et scalabilité livrées par Soken's Digital.",
};

export default function ProjectsIndexPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <ProjectExplorer />
        <ProjectsCta />
      </main>
      <SiteFooter />
    </>
  );
}
