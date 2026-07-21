"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { PageSection } from "@/lib/api/types";

type Phase = { phase: string; title: string; description: string };

const DEFAULT_TITLE = "Notre Processus";
const DEFAULT_PHASES: Phase[] = [
  {
    phase: "Phase 01",
    title: "Audit & Stratégie",
    description:
      "Analyse approfondie de vos processus métiers et définition des indicateurs de succès techniques.",
  },
  {
    phase: "Phase 02",
    title: "Architecture & Design",
    description:
      "Modélisation de l'infrastructure et conception de l'expérience utilisateur haute-fidélité.",
  },
  {
    phase: "Phase 03",
    title: "Développement Agile",
    description:
      "Sprint bi-mensuels avec livraisons continues et tests automatisés systématiques.",
  },
  {
    phase: "Phase 04",
    title: "Déploiement & Maintenance",
    description:
      "Mise en production sécurisée et monitoring proactif 24/7 de vos actifs numériques.",
  },
];

export function ProcessTimeline({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const PHASES: Phase[] = section?.items?.length ? (section.items as Phase[]) : DEFAULT_PHASES;

  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
        className="flex flex-col items-center text-center"
      >
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <span className="mt-3 h-0.5 w-10 rounded-full bg-primary" />
      </motion.div>

      <div className="relative mt-16">
        <div className="absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-white/10 md:block" />

        <div className="space-y-8 md:space-y-0">
          {PHASES.map((phase, i) => {
            const isLeft = i % 2 === 0;
            return (
              <div
                key={phase.phase}
                className={cn("relative md:grid md:grid-cols-2 md:gap-x-16", i > 0 && "md:-mt-6")}
              >
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.5 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
                  className={cn("relative", isLeft ? "md:col-start-1" : "md:col-start-2")}
                >
                  <div
                    className={cn(
                      "rounded-xl border-l-2 border-primary bg-card/60 p-5",
                      isLeft ? "md:mr-6" : "md:ml-6"
                    )}
                  >
                    <span className="text-[11px] font-semibold tracking-[0.15em] text-primary uppercase">
                      {phase.phase}
                    </span>
                    <h3 className="mt-1.5 text-lg font-semibold text-foreground">
                      {phase.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {phase.description}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "absolute top-8 hidden size-2.5 -translate-y-1/2 rounded-full bg-primary ring-4 ring-background md:block",
                      isLeft ? "-right-[3.05rem]" : "-left-[3.05rem]"
                    )}
                  />
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
