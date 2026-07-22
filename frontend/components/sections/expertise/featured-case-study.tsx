"use client";

import { motion } from "motion/react";
import { LineChart } from "lucide-react";
import { ProjectCardMedia } from "@/components/projects/card-media";
import type { PageSection } from "@/lib/api/types";
import type { Project } from "@/lib/projects/types";

const DEFAULT_KICKER = "Projet en Vedette";
const DEFAULT_TITLE = "Nexus Corp: Refonte Infrastructure Cloud";
const DEFAULT_SUBTITLE =
  "Découvrez comment nous avons aidé Nexus Corp à réduire ses temps de latence de 60% tout en automatisant 90% de ses déploiements critiques.";

type Props = {
  section?: PageSection | null;
  /** The project flagged "Featured" in Projets vitrine — drives the real
   * image/title/description/link here. Falls back to the section's own
   * (static, no image) copy when no project is marked Featured yet. */
  featuredProject?: Project | null;
};

export function FeaturedCaseStudy({ section, featuredProject }: Props) {
  const kicker = section?.kicker || DEFAULT_KICKER;

  const title = featuredProject?.title || DEFAULT_TITLE;
  const subtitle = featuredProject?.description || DEFAULT_SUBTITLE;
  const ctaLabel = section?.cta_label || "Lire l'étude de cas";
  const ctaLink = featuredProject ? `/projects/${featuredProject.slug}` : (section?.cta_link || "#contact");

  return (
    <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
        className="grid grid-cols-1 overflow-hidden rounded-2xl border-2 border-primary/25 bg-card/60 md:grid-cols-2"
      >
        <div
          aria-hidden
          className="relative aspect-[4/3] overflow-hidden md:aspect-auto"
        >
          {featuredProject ? (
            <ProjectCardMedia
              images={featuredProject.images} videoSrc={featuredProject.videoSrc} icon={featuredProject.visualIcon}
              iconClassName="relative size-14 text-primary/50"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary),transparent_75%),transparent_60%),linear-gradient(135deg,oklch(0.16_0.02_235),oklch(0.08_0.01_240))]">
              <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:28px_28px]" />
              <LineChart className="relative size-14 text-primary/50" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-10">
          <span className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
            {kicker}
          </span>
          <h3 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            {title}
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {subtitle}
          </p>
          <a
            href={ctaLink}
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {ctaLabel}
            <span aria-hidden>↗</span>
          </a>
        </div>
      </motion.div>
    </section>
  );
}
