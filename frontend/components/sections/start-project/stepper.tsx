"use client";

import { Check, User, Cog, Archive, Send, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepKey = "concept" | "technique" | "logistique" | "validation";

const STAGES: { key: StepKey; label: string; icon: LucideIcon }[] = [
  { key: "concept", label: "Concept", icon: User },
  { key: "technique", label: "Technique", icon: Cog },
  { key: "logistique", label: "Logistique", icon: Archive },
  { key: "validation", label: "Validation", icon: Send },
];

export function Stepper({ current }: { current: StepKey }) {
  const currentIndex = STAGES.findIndex((s) => s.key === current);

  return (
    <div className="flex items-start">
      {STAGES.map((stage, i) => {
        const status = i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";
        return (
          <div key={stage.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2 text-center">
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors sm:size-11",
                  status === "done" &&
                    "border-primary bg-primary text-primary-foreground",
                  status === "current" &&
                    "border-primary/60 bg-primary/10 text-primary",
                  status === "upcoming" &&
                    "border-white/10 bg-white/[0.03] text-muted-foreground"
                )}
              >
                {status === "done" ? (
                  <Check className="size-5" />
                ) : (
                  <stage.icon className="size-5" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-semibold tracking-[0.1em] uppercase sm:text-xs",
                  status === "upcoming" ? "text-muted-foreground" : "text-primary"
                )}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  "mx-2 h-px flex-1 sm:mx-3",
                  status === "done" ? "bg-primary" : "bg-white/10"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
