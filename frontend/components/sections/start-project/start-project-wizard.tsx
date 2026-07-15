"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper, type StepKey } from "@/components/sections/start-project/stepper";
import { StepConcept } from "@/components/sections/start-project/step-concept";
import { StepTechnique } from "@/components/sections/start-project/step-technique";
import { StepLogistique } from "@/components/sections/start-project/step-logistique";
import { StepSuccess } from "@/components/sections/start-project/step-success";
import {
  INITIAL_FORM_DATA,
  type ProjectFormData,
} from "@/components/sections/start-project/types";

const FORM_STEPS: StepKey[] = ["concept", "technique", "logistique"];

const STEP_COPY: Record<StepKey, { title: string; subtitle: string }> = {
  concept: {
    title: "Démarrer un Projet",
    subtitle: "Étape 1 : Parlez-nous de vous et de votre vision.",
  },
  technique: {
    title: "Démarrer un Projet",
    subtitle: "Étape 2 : Définissez vos objectifs et vos ressources.",
  },
  logistique: {
    title: "Démarrer un Projet",
    subtitle:
      "Configurez les derniers détails logistiques pour que nos équipes puissent commencer le déploiement de votre solution.",
  },
  validation: { title: "", subtitle: "" },
};

function generateReference() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 3; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `SKN-2026-${code}`;
}

export function StartProjectWizard() {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState<ProjectFormData>(INITIAL_FORM_DATA);
  const [reference] = useState(generateReference);

  const update = (patch: Partial<ProjectFormData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const currentKey: StepKey = submitted ? "validation" : FORM_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === FORM_STEPS.length - 1;

  const goNext = () => {
    if (isLast) {
      setSubmitted(true);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, FORM_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPrev = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <section className="mx-auto max-w-5xl px-4 pt-32 pb-24 sm:px-6 sm:pt-40 lg:px-8">
        <StepSuccess data={data} reference={reference} />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pt-32 pb-24 sm:px-6 sm:pt-40 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {STEP_COPY[currentKey].title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {STEP_COPY[currentKey].subtitle}
          </p>
        </div>
        <a
          href="/suivi-projet"
          className="shrink-0 text-sm font-medium text-foreground underline decoration-white/30 underline-offset-4 hover:text-primary hover:decoration-primary"
        >
          Suivre un projet
        </a>
      </div>

      <div className="mt-10">
        <Stepper current={currentKey} />
      </div>

      <div className="mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
            {currentKey === "concept" && <StepConcept data={data} update={update} />}
            {currentKey === "technique" && <StepTechnique data={data} update={update} />}
            {currentKey === "logistique" && <StepLogistique data={data} update={update} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-10 flex items-center justify-between">
        {isFirst ? (
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Annuler
          </a>
        ) : (
          <button
            type="button"
            onClick={goPrev}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Précédent
          </button>
        )}

        <Button
          onClick={goNext}
          size="lg"
          className={
            isLast
              ? "h-12 rounded-lg bg-primary px-7 text-sm font-semibold tracking-wide text-primary-foreground uppercase shadow-[0_0_30px_-6px_color-mix(in_oklch,var(--primary),transparent_30%)] hover:bg-primary/90"
              : "h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          }
        >
          <span className="inline-flex items-center gap-2">
            {isLast ? "Soumettre le Projet" : "Suivant"}
            <ArrowRight className="size-4" />
          </span>
        </Button>
      </div>
    </section>
  );
}
