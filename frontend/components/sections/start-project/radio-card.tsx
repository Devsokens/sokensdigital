"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type RadioCardProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
  compact?: boolean;
};

export function RadioCard({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
  compact = false,
}: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative w-full rounded-xl border p-4 text-left transition-colors",
        selected
          ? "border-primary/60 bg-primary/5"
          : "border-white/10 bg-white/[0.02] hover:border-white/20"
      )}
    >
      <span
        className={cn(
          "absolute top-4 right-4 inline-flex size-4 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-white/20"
        )}
      >
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>

      <Icon className={cn("size-5", selected ? "text-primary" : "text-foreground/80")} />

      <h4 className={cn("mt-3 font-semibold text-foreground", compact ? "text-sm" : "text-base")}>
        {title}
      </h4>
      {description && (
        <p className="mt-1.5 pr-4 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </button>
  );
}
