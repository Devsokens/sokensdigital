import Link from "next/link";
import { Diamond } from "lucide-react";
import { SectionIcon } from "@/components/dynamic-icon";
import type { Project } from "@/lib/projects/types";

export function RelatedProjects({ projects }: { projects: Project[] }) {
  if (projects.length === 0) return null;

  return (
    <div className="mt-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-primary uppercase">
            <Diamond className="size-2.5 fill-primary" />
            Information
          </span>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Projets similaires
          </h2>
        </div>
        <Link
          href="/projects"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Voir plus
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.slug}
            href={`/projects/${project.slug}`}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-card/60 transition-colors hover:border-primary/30"
          >
            <div
              aria-hidden
              className="relative flex aspect-video items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_70%_30%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_65%),linear-gradient(160deg,oklch(0.17_0.02_235),oklch(0.08_0.01_240))]"
            >
              <SectionIcon name={project.visualIcon} className="size-9 text-primary/50 transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div className="p-4">
              <h3 className="text-sm font-semibold text-foreground">{project.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
