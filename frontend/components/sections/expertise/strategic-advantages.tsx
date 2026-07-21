"use client";

import { motion } from "motion/react";
import type { PageSection } from "@/lib/api/types";
import { SectionIcon } from "@/components/dynamic-icon";

type Advantage = { icon: string; title: string; description: string };

const DEFAULT_TITLE = "Avantages Stratégiques";
const DEFAULT_SUBTITLE = "L'ingénierie logicielle au service de votre croissance, avec un accent mis sur la robustesse et la rapidité d'exécution.";
const DEFAULT_ADVANTAGES: Advantage[] = [
  { icon: "shield-check", title: "Sécurité Native", description: "Chaque ligne de code est auditée pour garantir une étanchéité totale face aux menaces cybernétiques modernes." },
  { icon: "zap", title: "Performance Critique", description: "Optimisation millimétrée du temps de réponse et de la charge serveur pour une expérience utilisateur instantanée." },
  { icon: "layers", title: "Scalabilité Infinie", description: "Architecture cloud-native conçue pour supporter une montée en charge exponentielle sans interruption." },
];

export function StrategicAdvantages({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const subtitle = section?.subtitle || DEFAULT_SUBTITLE;
  const advantages: Advantage[] = section?.items?.length ? (section.items as Advantage[]) : DEFAULT_ADVANTAGES;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
      >
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
          {subtitle}
        </p>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {advantages.map((advantage, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const }}
            className="rounded-2xl border border-white/10 bg-card/60 p-6 transition-colors hover:border-primary/30"
          >
            <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <SectionIcon name={advantage.icon} className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {advantage.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {advantage.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
