"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { ONBOARDING_STEPS, useOnboardingTour } from "@/lib/admin/onboarding-tour";
import { useTargetRect } from "@/lib/admin/use-target-rect";
import { SpotlightOverlay } from "@/components/admin/spotlight-overlay";

export function OnboardingOverlay() {
  const { active, step, stepIndex, next, prev, skip } = useOnboardingTour();
  const rect = useTargetRect(step?.id);
  const isLast = stepIndex === ONBOARDING_STEPS.length - 1;

  if (!active || !step) return null;

  return (
    <SpotlightOverlay
      rect={rect}
      placement={step.placement}
      title={step.title}
      description={step.description}
      meta={`${stepIndex + 1} / ${ONBOARDING_STEPS.length}`}
      tooltipKey={step.id}
      onDismiss={skip}
      footer={
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={stepIndex === 0}
            className="flex items-center gap-1 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-700 disabled:pointer-events-none disabled:opacity-0"
          >
            <ArrowLeft className="size-3.5" /> Précédent
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            {isLast ? "Terminer" : "Suivant"}
            {!isLast && <ArrowRight className="size-3.5" />}
          </button>
        </div>
      }
    />
  );
}
