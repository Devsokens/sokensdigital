"use client";

import { useState } from "react";
import { LayoutDashboard, Smartphone, Server, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const VIEWS = [
  { key: "dashboard", label: "Vue tableau de bord", icon: LayoutDashboard },
  { key: "mobile", label: "Vue mobile", icon: Smartphone },
  { key: "infra", label: "Vue infrastructure", icon: Server },
  { key: "analytics", label: "Vue analytique", icon: BarChart3 },
];

export function ProjectGallery({ title }: { title: string }) {
  const [active, setActive] = useState(0);
  const ActiveIcon = VIEWS[active].icon;

  return (
    <div>
      <div
        aria-label={`${title} — ${VIEWS[active].label}`}
        className="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_60%_20%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_60%),linear-gradient(150deg,oklch(0.16_0.02_235),oklch(0.07_0.01_240))]"
      >
        <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:28px_28px]" />
        <ActiveIcon className="relative size-14 text-primary/40" />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-3">
        {VIEWS.map((view, i) => (
          <button
            key={view.key}
            type="button"
            onClick={() => setActive(i)}
            aria-label={view.label}
            aria-pressed={active === i}
            className={cn(
              "relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border transition-colors",
              active === i
                ? "border-primary/60 bg-primary/5"
                : "border-white/10 bg-white/[0.02] hover:border-white/20"
            )}
          >
            <view.icon
              className={cn(
                "size-5",
                active === i ? "text-primary" : "text-muted-foreground"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
