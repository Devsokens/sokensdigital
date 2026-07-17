import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string;
  sublabel: string;
};

export function ArticleVisual({ icon: Icon, label, sublabel }: Props) {
  return (
    <div
      aria-hidden
      className="relative flex aspect-[21/9] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary),transparent_75%),transparent_60%),linear-gradient(135deg,oklch(0.16_0.02_235),oklch(0.07_0.01_240))]"
    >
      <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:28px_28px]" />
      <Icon className="relative size-16 text-primary/40 sm:size-20" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 py-4">
        <span className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">
          {label}
        </span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}
