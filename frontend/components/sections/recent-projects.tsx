"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LaptopMockup } from "@/components/projects/laptop-mockup";
import type { PageSection } from "@/lib/api/types";
import type { Project } from "@/lib/projects/types";

export function RecentProjects({ section, projects }: { section?: PageSection | null; projects: Project[] }) {
  const [index, setIndex] = useState(0);
  const kicker = section?.kicker || "Réalisations";
  const title = section?.title || "Projects récents";

  if (projects.length === 0) return null;
  const project = projects[index];

  const goTo = (delta: number) => {
    setIndex((prev) => (prev + delta + projects.length) % projects.length);
  };

  return (
    <section id="projects" className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
              {kicker}
            </span>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
          <LaptopMockup
            key={project.slug}
            title={project.title}
            videoSrc={project.videoSrc}
            images={project.images}
            sceneVariants={project.sceneVariants}
          />

          <div>
            <span className="text-xs font-semibold tracking-[0.1em] text-primary uppercase">
              {project.tag}
            </span>
            <h3 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              {project.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {project.description}
            </p>
            <Button
              render={<Link href={`/projects/${project.slug}`}>Découvrir l&apos;étude</Link>}
              nativeButton={false}
              variant="outline"
              className="mt-6 rounded-full border-white/15 bg-transparent px-6 text-sm font-medium text-foreground hover:bg-white/5"
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-2">
          {projects.map((p, i) => (
            <span
              key={p.slug}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === index ? "bg-primary" : "bg-white/15"
              )}
            />
          ))}
          <div className="ml-3 flex gap-2">
            <button
              type="button"
              onClick={() => goTo(-1)}
              aria-label="Projet précédent"
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 text-foreground transition-colors hover:bg-white/5"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => goTo(1)}
              aria-label="Projet suivant"
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/15 text-foreground transition-colors hover:bg-white/5"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
