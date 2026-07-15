"use client";

import { motion } from "motion/react";
import { Diamond } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlueprintDiagram } from "@/components/sections/expertise/blueprint-diagram";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
};

export function ExpertiseHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_55%_at_20%_-10%,color-mix(in_oklch,var(--primary),transparent_85%),transparent)]"
      />

      <div className="mx-auto max-w-6xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-24 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <motion.div variants={container} initial="hidden" animate="show">
            <motion.div
              variants={item}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-[11px] font-medium tracking-[0.15em] text-primary uppercase sm:text-xs"
            >
              <Diamond className="size-2.5 fill-primary" />
              Digital Excellence
            </motion.div>

            <motion.h1
              variants={item}
              className="text-4xl leading-[1.1] font-semibold tracking-tight text-foreground sm:text-5xl"
            >
              Solutions Digitales Sur Mesure
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Propulsez votre entreprise vers l&apos;avenir avec des
              infrastructures logicielles de haute précision. Nous concevons
              des écosystèmes scalables, sécurisés et centrés sur la
              performance pour les leaders de demain.
            </motion.p>

            <motion.div variants={item} className="mt-9">
              <Button
                render={
                  <a href="/demarrer-un-projet" className="inline-flex items-center gap-1.5">
                    Démarrer un projet
                    <span aria-hidden>→</span>
                  </a>
                }
                nativeButton={false}
                size="lg"
                className="h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-card/60">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  Soken&apos;s Digital — Solutions Logicielles
                </span>
                <div className="flex gap-1.5">
                  <span className="size-1.5 rounded-full bg-white/20" />
                  <span className="size-1.5 rounded-full bg-white/20" />
                  <span className="size-1.5 rounded-full bg-primary/60" />
                </div>
              </div>
              <div className="aspect-[16/10] p-4">
                <BlueprintDiagram />
              </div>
              <div className="border-t border-white/10 px-5 py-4">
                <span className="text-[11px] font-semibold tracking-[0.1em] text-primary uppercase">
                  Architecture High-Load
                </span>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  Précision Sans Compromis
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
