import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  category: string;
  statusTag: string;
  title: string;
  description: string;
};

export function ProjectHeroBanner({ icon: Icon, category, statusTag, title, description }: Props) {
  return (
    <div>
      <div
        aria-hidden
        className="relative flex aspect-[21/9] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_25%_30%,color-mix(in_oklch,var(--primary),transparent_75%),transparent_60%),linear-gradient(135deg,oklch(0.16_0.02_235),oklch(0.06_0.01_240))]"
      >
        <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:32px_32px]" />
        <Icon className="relative size-16 text-primary/30 sm:size-24" />
      </div>

      <div className="mt-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold tracking-[0.1em] text-primary uppercase">
            {category}
          </span>
          <span className="text-xs text-muted-foreground">• {statusTag}</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      </div>
    </div>
  );
}
