import { ExternalLink } from "lucide-react";
import { ProjectCardMedia } from "@/components/projects/card-media";

type Props = {
  icon: string;
  category: string;
  statusTag: string;
  title: string;
  description: string;
  projectUrl?: string;
  images?: string[];
  videoSrc?: string;
};

export function ProjectHeroBanner({ icon, category, statusTag, title, description, projectUrl, images, videoSrc }: Props) {
  return (
    <div>
      <div
        aria-hidden
        className="relative aspect-[21/9] overflow-hidden rounded-2xl border-2 border-primary/25"
      >
        <ProjectCardMedia
          images={images} videoSrc={videoSrc} icon={icon}
          iconClassName="relative size-16 text-primary/30 sm:size-24"
        />
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
        {projectUrl && (
          <a
            href={projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Visiter le projet
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
