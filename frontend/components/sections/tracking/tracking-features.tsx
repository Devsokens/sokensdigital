"use client";

import { motion } from "motion/react";
import { Shield, Gauge, BadgeCheck, type LucideIcon } from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: Shield,
    title: "Sécurité Active",
    description:
      "Toutes les données de ce projet sont chiffrées de bout en bout et accessibles uniquement via votre portail sécurisé.",
  },
  {
    icon: Gauge,
    title: "Performance",
    description:
      "Suivi en temps réel avec latence réduite pour une visibilité instantanée sur l'avancement de vos livrables.",
  },
  {
    icon: BadgeCheck,
    title: "Audit Continu",
    description:
      "Chaque étape validée par notre équipe qualité avant transmission, pour une traçabilité complète du projet.",
  },
];

export function TrackingFeatures() {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] as const }}
            className="rounded-2xl border border-white/10 bg-card/60 p-6 transition-colors hover:border-primary/30"
          >
            <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <feature.icon className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
