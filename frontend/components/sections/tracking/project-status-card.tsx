"use client";

import { motion } from "motion/react";
import {
  Check,
  BarChart3,
  Compass,
  Code2,
  Rocket,
  Calendar,
  MessagesSquare,
  Headset,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StepStatus = "done" | "current" | "upcoming";

type Step = {
  label: string;
  icon: LucideIcon;
  status: StepStatus;
};

const STEPS: Step[] = [
  { label: "Soumis", icon: Check, status: "done" },
  { label: "Analyse", icon: BarChart3, status: "current" },
  { label: "Cadrage", icon: Compass, status: "upcoming" },
  { label: "Développement", icon: Code2, status: "upcoming" },
  { label: "Déploiement", icon: Rocket, status: "upcoming" },
];

export function ProjectStatusCard() {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
        className="overflow-hidden rounded-2xl border border-white/10 bg-card/60"
      >
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-primary uppercase">
              Référence: SKN-2026-X92
              <span className="size-1.5 rounded-full bg-emerald-400" />
            </span>
            <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              Refonte Écosystème Cloud Banking
            </h2>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
            Analyse Technique en cours
          </span>
        </div>

        <div className="border-t border-white/10 px-6 py-8 sm:px-8">
          <div className="flex items-start overflow-x-auto pb-1 sm:overflow-visible">
            {STEPS.map((step, i) => (
              <div
                key={step.label}
                className="flex shrink-0 items-center sm:flex-1 sm:shrink last:sm:flex-none"
              >
                <div className="flex w-20 shrink-0 flex-col items-center gap-2 text-center">
                  <div
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
                      step.status === "done" &&
                        "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary),transparent_80%)]",
                      step.status === "current" &&
                        "border-primary/60 bg-primary/10 text-primary",
                      step.status === "upcoming" &&
                        "border-white/10 bg-white/[0.03] text-muted-foreground"
                    )}
                  >
                    <step.icon className="size-5" />
                  </div>
                  <span
                    className={cn(
                      "text-[11px] leading-tight font-medium text-balance sm:text-sm",
                      step.status === "upcoming" ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mx-1.5 h-px w-6 shrink-0 sm:mx-3 sm:w-auto sm:flex-1",
                      step.status === "done" ? "bg-primary" : "bg-white/10"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 border-t border-white/10 p-6 sm:grid-cols-2 sm:p-8">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <span className="block text-xs text-muted-foreground">Délai estimé</span>
              <span className="block text-sm font-medium text-foreground">
                T2 2026 (Phase 1 : 14 jours restants)
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <MessagesSquare className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <span className="block text-xs text-muted-foreground">
                Canal de communication
              </span>
              <span className="block text-sm font-medium text-foreground">
                Portail Sécurisé &amp; Slack Connect
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 p-6 sm:flex-row sm:p-8">
          <Button
            render={
              <a href="#contact" className="inline-flex items-center justify-center gap-2">
                <Headset className="size-4" />
                Contacter un expert
              </a>
            }
            nativeButton={false}
            className="h-11 rounded-lg bg-foreground px-5 text-sm font-semibold text-background hover:bg-foreground/90"
          />
          <Button
            render={
              <a href="#" className="inline-flex items-center justify-center gap-2">
                <FileText className="size-4" />
                Télécharger le NDA
              </a>
            }
            nativeButton={false}
            variant="outline"
            className="h-11 rounded-lg border-white/15 bg-transparent px-5 text-sm font-semibold text-foreground hover:bg-white/5"
          />
        </div>
      </motion.div>
    </section>
  );
}
