"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectCardMedia } from "@/components/projects/card-media";
import type { Project } from "@/lib/projects/types";

const ALL = "All";

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export function ProjectExplorer({ projects }: { projects: Project[] }) {
  const [type, setType] = useState(ALL);
  const [techStack, setTechStack] = useState(ALL);
  const [sector, setSector] = useState(ALL);
  const [query, setQuery] = useState("");

  const types = useMemo(() => unique(projects.map((p) => p.type)), [projects]);
  const techStacks = useMemo(
    () => unique(projects.flatMap((p) => p.technologies)),
    [projects]
  );
  const sectors = useMemo(() => unique(projects.map((p) => p.sector)), [projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (type !== ALL && p.type !== type) return false;
      if (sector !== ALL && p.sector !== sector) return false;
      if (techStack !== ALL && !p.technologies.includes(techStack)) return false;
      if (
        q &&
        !p.title.toLowerCase().includes(q) &&
        !p.client.toLowerCase().includes(q) &&
        !p.technologies.some((t) => t.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [projects, type, sector, techStack, query]);

  return (
    <section className="mx-auto max-w-6xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-24 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Nos Projects
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
        Explorer la frontière entre la précision technique et la vision
        créative. Chaque projet est un exercice d&apos;ingénierie numérique
        de haute performance.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <FilterSelect
            label="Type"
            value={type}
            onChange={setType}
            options={types}
          />
          <FilterSelect
            label="Tech Stack"
            value={techStack}
            onChange={setTechStack}
            options={techStacks}
            hideLabelPrefix
          />
          <FilterSelect
            label="Secteur"
            value={sector}
            onChange={setSector}
            options={sectors}
            hideLabelPrefix
          />
        </div>

        <label className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher des systèmes ...."
            className="w-full rounded-lg border border-white/10 bg-white/[0.02] py-2.5 pr-3.5 pl-10 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          Aucun projet ne correspond à ces critères.
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:auto-rows-[13rem] lg:grid-cols-3 lg:grid-flow-dense">
          {filtered.map((project, i) => (
            <ProjectCard
              key={project.slug}
              project={project}
              tall={i === 0 || i === 1}
            />
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <span
          aria-disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-full border border-white/10 px-6 py-2.5 text-sm font-medium text-muted-foreground/60"
        >
          Accéder aux Archives
          <span aria-hidden>→</span>
        </span>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  hideLabelPrefix = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  hideLabelPrefix?: boolean;
}) {
  return (
    <label className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-foreground">
      {!hideLabelPrefix && <span className="mr-1 text-muted-foreground">{label}:</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="bg-transparent focus:outline-none"
      >
        <option value={ALL} className="bg-background">
          {hideLabelPrefix ? label : "All"}
        </option>
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-background">
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProjectCard({ project, tall }: { project: Project; tall: boolean }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/60 transition-colors hover:border-primary/30",
        tall && "lg:row-span-2"
      )}
    >
      <div aria-hidden className="relative min-h-[10rem] flex-1 overflow-hidden">
        <ProjectCardMedia images={project.images} videoSrc={project.videoSrc} icon={project.visualIcon} />
        {project.featured && (
          <span className="absolute top-3 right-3 z-10 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-primary-foreground uppercase">
            Featured
          </span>
        )}
      </div>
      <div className="p-4">
        <span className="text-xs text-muted-foreground">{project.client}</span>
        <h3 className="mt-1 text-base font-semibold text-foreground">{project.title}</h3>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-foreground/80">
            {project.type}
          </span>
          {project.technologies.slice(0, 2).map((tech) => (
            <span
              key={tech}
              className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-foreground/80"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
