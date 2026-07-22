import { ProjectCardMedia } from "@/components/projects/card-media";

type Props = {
  icon: string;
  image?: string;
  label: string;
  sublabel: string;
};

export function ArticleVisual({ icon, image, label, sublabel }: Props) {
  return (
    <div
      aria-hidden
      className="relative aspect-[21/9] overflow-hidden rounded-2xl border-2 border-primary/25"
    >
      <ProjectCardMedia
        images={image ? [image] : undefined} icon={icon}
        iconClassName="relative size-16 text-primary/40 sm:size-20"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-5 py-4">
        <span className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">
          {label}
        </span>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}
