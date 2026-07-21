import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProjectHeroBanner } from "@/components/projects/project-hero-banner";
import { ProjectGallery } from "@/components/projects/project-gallery";
import { TechnicalSpecs } from "@/components/projects/technical-specs";
import { ProjectStats } from "@/components/projects/project-stats";
import { RelatedProjects } from "@/components/projects/related-projects";
import { getShowcaseProjectBySlug, getShowcaseProjects, getRelatedShowcaseProjects } from "@/lib/projects/public";

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
  return {
    title: `${project.title} — Soken's Digital`,
    description: project.description,
  };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [project, allProjects] = await Promise.all([
    getShowcaseProjectBySlug(slug),
    getShowcaseProjects(),
  ]);
  if (!project) notFound();

  const relatedProjects = getRelatedShowcaseProjects(allProjects, project.slug);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 sm:pt-32 sm:pb-24 lg:px-8">
          <Link
            href="/projects"
            aria-label="Retour aux projets"
            className="mb-6 inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <ProjectHeroBanner
            icon={project.visualIcon}
            category={project.category}
            statusTag={project.statusTag}
            title={project.title}
            description={project.description}
            projectUrl={project.projectUrl}
          />

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
            <ProjectGallery title={project.title} images={project.images} videoSrc={project.videoSrc} />
            <TechnicalSpecs
              client={project.client}
              technologies={project.technologies}
              timeline={project.timeline}
              leadName={project.leadName}
              leadRole={project.leadRole}
            />
          </div>

          <div className="mt-14">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Le Défi
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {project.challenge}
            </p>
          </div>

          <div className="mt-8">
            <ProjectStats stats={project.stats} />
          </div>

          <div className="mt-14">
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              La Solution
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {project.solution}
            </p>
            <ul className="mt-5 space-y-3">
              {project.solutionPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="size-3" />
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <RelatedProjects projects={relatedProjects} />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
