"use client";

import { Cog, ChevronDown, Lightbulb } from "lucide-react";
import type { ProjectFormData, SolutionOption } from "@/components/sections/start-project/types";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/50 focus:outline-none";

type Props = {
  data: ProjectFormData;
  update: (patch: Partial<ProjectFormData>) => void;
  solutions: SolutionOption[];
};

export function StepTechnique({ data, update, solutions }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="rounded-2xl border border-white/10 bg-card/60 p-6 sm:p-7">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Cog className="size-5 text-primary" />
          Configuration Technique
        </h3>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs text-muted-foreground">Type de Solution</span>
            <span className="relative block">
              <select
                value={data.typeSolution}
                onChange={(e) => update({ typeSolution: e.target.value })}
                className={`${inputClass} appearance-none pr-9`}
              >
                {solutions.map((type) => (
                  <option key={type.label} value={type.label} className="bg-background">
                    {type.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Budget Estimé (EUR)
            </span>
            <span className="relative block">
              <input
                type="number"
                value={data.budget}
                onChange={(e) => update({ budget: e.target.value })}
                placeholder="Ex: 5000"
                className={`${inputClass} pr-8`}
              />
              <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">
                €
              </span>
            </span>
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs text-muted-foreground">
              Cahier des charges / Description
            </span>
            <textarea
              rows={5}
              value={data.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder="Décrivez vos objectifs principaux, les contraintes techniques et les délais souhaités pour votre projet..."
              className={`${inputClass} resize-none`}
            />
          </label>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-card/60 p-5 text-center">
          <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Durée moyenne
          </span>
          <p className="mt-1 text-2xl font-bold text-primary">2 min</p>
        </div>

        <div className="rounded-2xl border border-primary/40 bg-primary/[0.04] p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lightbulb className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Besoin d&apos;aide ?</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Nos experts sont disponibles pour une session de cadrage
                gratuite pour affiner votre projet.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
