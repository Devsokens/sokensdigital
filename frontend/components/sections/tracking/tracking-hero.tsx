"use client";

import { motion } from "motion/react";
import { Fingerprint, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrackingHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--primary),transparent_65%),transparent_55%)]"
      />

      <div className="mx-auto max-w-2xl px-4 pt-32 pb-14 text-center sm:px-6 sm:pt-40 sm:pb-16 lg:px-8">
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
          className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
        >
          Suivi de Projet
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] as const }}
          className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-muted-foreground"
        >
          Accédez en temps réel à l&apos;état d&apos;avancement de votre
          solution digitale sécurisée. Saisissez votre code de référence
          unique ci-dessous.
        </motion.p>

        <motion.form
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
          onSubmit={(e) => e.preventDefault()}
          className="mx-auto mt-8 flex max-w-xl flex-col gap-3 rounded-2xl border border-white/10 bg-card/60 p-2 sm:flex-row"
        >
          <label className="flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5">
            <Fingerprint className="size-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="EX: SKN-2026-X92"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </label>
          <Button
            type="submit"
            className="h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <span className="inline-flex items-center gap-2">
              Vérifier le Statut
              <Radar className="size-4" />
            </span>
          </Button>
        </motion.form>
      </div>
    </section>
  );
}
