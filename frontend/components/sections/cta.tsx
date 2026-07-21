import { Button } from "@/components/ui/button";
import type { PageSection } from "@/lib/api/types";

const DEFAULT_TITLE = "Prêt pour votre transformation digitale ?";
const DEFAULT_SUBTITLE = "Discutons de vos objectifs et élaborons ensemble la roadmap technique de votre succès.";

export function Cta({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const subtitle = section?.subtitle || DEFAULT_SUBTITLE;
  const ctaLabel = section?.cta_label || "Démarrer un Projet";
  const ctaLink = section?.cta_link || "/demarrer-un-projet";

  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-card/60 px-6 py-16 text-center sm:px-12 sm:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary),transparent_88%),transparent)]"
        />
        <h2 className="relative text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl md:text-4xl">
          {title}
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          {subtitle}
        </p>
        <Button
          render={
            <a href={ctaLink}>
              {ctaLabel}
              <span aria-hidden>→</span>
            </a>
          }
          nativeButton={false}
          size="lg"
          className="relative mt-8 h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        />
      </div>
    </section>
  );
}
