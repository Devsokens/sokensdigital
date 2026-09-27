"use client";

import { motion } from "motion/react";
import { Check, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageSection } from "@/lib/api/types";

const EASE = [0.16, 1, 0.3, 1] as const;

type Phase = { phase: string; title: string; description: string };

const DEFAULT_TITLE = "Notre Processus";
const DEFAULT_SUBTITLE =
  "Une méthode éprouvée, en quatre étapes, pour transformer votre vision en un actif numérique robuste et mesurable.";
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function ProcessTimeline({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const subtitle = section?.subtitle || DEFAULT_SUBTITLE;
  const PHASES: Phase[] = section?.items?.length ? (section.items as Phase[]) : DEFAULT_PHASES;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[380px_1fr] lg:gap-16">
        {/* Colonne gauche : reste visible pendant que la timeline défile
         * (lg:sticky) — sur mobile, elle redevient un simple bloc en tête
         * de section, la position sticky n'ayant pas grand sens sans place
         * pour défiler à côté. */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="lg:sticky lg:top-28 lg:self-start"
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-primary uppercase sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>

          <div className="relative mt-8 overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-primary/15 blur-3xl"
            />
            <span className="relative inline-flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Workflow className="size-7" />
            </span>
            <p className="relative mt-5 text-sm leading-relaxed text-foreground/80">
              Chaque étape est cadrée, livrée et validée avant de passer à la
              suivante — aucune surprise de calendrier ou de périmètre.
            </p>
          </div>
        </motion.div>

        {/* Colonne droite : timeline verticale, un repère qui se remplit
         * (coche) au fil du défilement, à la place des demi-cercles
         * centrés d'avant qui n'avaient de sens qu'en disposition 2
         * colonnes symétrique. */}
        <div className="relative">
          <div className="absolute top-3 bottom-3 left-3 w-px bg-white/10" />

          {PHASES.map((phase, i) => (
            <motion.div
              key={phase.phase || i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
              className={cn("relative flex gap-5 sm:gap-7", i > 0 && "mt-10 sm:mt-12")}
            >
              <div className="relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-background">
                {/* Vide au repos ; se remplit (coche + fond primaire) une
                 * fois l'étape défilée dans la vue — le repère "où j'en
                 * suis" que ne rendait pas le simple point centré d'avant. */}
                <motion.span
                  initial={{ scale: 0.4, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.35, delay: 0.15, ease: EASE }}
                  className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                >
                  <Check className="size-3.5" />
                </motion.span>
              </div>

              <div className="flex flex-1 gap-4 sm:gap-6">
                <span className="text-4xl font-extrabold leading-none tracking-tight text-primary sm:text-5xl">
                  {pad(i + 1)}
                </span>
                <div className="pt-1">
                  <h3 className="text-lg font-semibold text-foreground sm:text-xl">
                    {phase.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {phase.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
