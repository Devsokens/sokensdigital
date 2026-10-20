import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VitrineShell } from "@/components/vitrine/vitrine-shell";
import { ProjectDetailView } from "@/components/vitrine/project-detail";
import { resolveSection } from "@/components/vitrine/cms";
import { PROJECTS_CTA } from "@/components/vitrine/defaults";
import { getPageSections } from "@/lib/api/public";
import { getShowcaseProjectBySlug, getShowcaseProjects, getRelatedShowcaseProjects } from "@/lib/projects/public";
import { pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, projectSchema } from "@/lib/seo/structured-data";

export async function generateStaticParams() {
  const projects = await getShowcaseProjects();
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getShowcaseProjectBySlug(slug);
  if (!project) return {};
  return pageMetadata({
    title: project.title,
    description: project.summary || project.description,
    path: `/projects/${project.slug}`,
    image: project.images?.[0],
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [project, allProjects, projectsSections] = await Promise.all([
    getShowcaseProjectBySlug(slug),
    getShowcaseProjects(),
    getPageSections("PROJETS"),
  ]);
  if (!project) notFound();

  return (
    <>
      <JsonLd
        data={[
          projectSchema({
            title: project.title,
            description: project.description,
            path: `/projects/${project.slug}`,
            image: project.images?.[0],
          }),
          breadcrumbSchema([
            { name: "Accueil", path: "/" },
            { name: "Projets", path: "/projects" },
            { name: project.title, path: `/projects/${project.slug}` },
          ]),
        ]}
      />
      <VitrineShell page="projets">
        <ProjectDetailView
          project={project}
          related={getRelatedShowcaseProjects(allProjects, project.slug)}
          cta={resolveSection(projectsSections, "projects_cta", PROJECTS_CTA)}
        />
      </VitrineShell>
    </>
  );
}
