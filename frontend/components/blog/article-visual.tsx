import { ProjectCardMedia } from "@/components/projects/card-media";

export function ArticleVisual({ image }: { image?: string }) {
  return (
    <div aria-hidden className="relative aspect-[21/9] overflow-hidden rounded-2xl border-2 border-primary/25">
      <ProjectCardMedia images={image ? [image] : undefined} iconClassName="relative size-16 text-primary/30 sm:size-20" />
    </div>
  );
}
