"use client";

import { motion } from "motion/react";
import { LineChart } from "lucide-react";

export function FeaturedCaseStudy() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-card/60 md:grid-cols-2"
      >
        <div
          aria-hidden
          className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary),transparent_75%),transparent_60%),linear-gradient(135deg,oklch(0.16_0.02_235),oklch(0.08_0.01_240))] md:aspect-auto"
        >
          <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:28px_28px]" />
          <LineChart className="relative size-14 text-primary/50" />
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-10">
          <span className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
            Projet en Vedette
          </span>
          <h3 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            Nexus Corp: Refonte Infrastructure Cloud
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            Découvrez comment nous avons aidé Nexus Corp à réduire ses temps
            de latence de 60% tout en automatisant 90% de ses déploiements
            critiques.
          </p>
          <a
            href="#contact"
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            Lire l&apos;étude de cas
            <span aria-hidden>↗</span>
          </a>
        </div>
      </motion.div>
    </section>
  );
}
