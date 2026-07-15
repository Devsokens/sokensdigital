"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Project = {
  tag: string;
  title: string;
  description: string;
};

const PROJECTS: Project[] = [
  {
    tag: "FINTECH · SAAS",
    title: "Nova Finance Dashboard",
    description:
      "Refonte complète de l'interface de trading haute fréquence avec latence réduite de 40%.",
  },
  {
    tag: "LOGISTIQUE · CLOUD",
    title: "AeroLogistics Platform",
    description:
      "Plateforme robuste de gestion de flotte gérant plus d'un million de transactions quotidiennes.",
  },
  {
    tag: "SANTÉ · SÉCURITÉ",
    title: "MediSecure Portal",
    description:
      "Infrastructure conforme HDS pour la gestion sécurisée de dossiers médicaux sensibles.",
  },
];

export function RecentProjects() {
  const [index, setIndex] = useState(0);
  const project = PROJECTS[index];

  const goTo = (delta: number) => {
    setIndex((prev) => (prev + delta + PROJECTS.length) % PROJECTS.length);
  };

  return (
    <section id="projects" className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
              Réalisations
            </span>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Projects récents
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-center">
          <div
            aria-hidden
            className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary),transparent_75%),transparent_60%),linear-gradient(135deg,oklch(0.16_0.02_235),oklch(0.08_0.01_240))]"
          >
            <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:28px_28px]" />
            <Sparkles className="absolute right-6 bottom-6 size-8 text-primary/40" />
          </div>

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
              render={<a href="#contact">Découvrir l&apos;étude</a>}
              nativeButton={false}
              variant="outline"
              className="mt-6 rounded-full border-white/15 bg-transparent px-6 text-sm font-medium text-foreground hover:bg-white/5"
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-2">
          {PROJECTS.map((p, i) => (
            <span
              key={p.title}
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
