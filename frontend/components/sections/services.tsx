import {
  LayoutGrid,
  Globe,
  Smartphone,
  MonitorCog,
  Workflow,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { PageSection } from "@/lib/api/types";

type Service = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const ICONS: Record<string, LucideIcon> = {
  LayoutGrid, Globe, Smartphone, MonitorCog, Workflow, TrendingUp,
};

const DEFAULT_TITLE = "Ingénierie de Précision";
const DEFAULT_SUBTITLE =
  "Notre arsenal technologique est conçu pour répondre aux défis les plus complexes de l'industrie numérique.";
const DEFAULT_SERVICES: Service[] = [
  { icon: LayoutGrid, title: "Solutions sur Mesure", description: "Architecture logicielle robuste conçue spécifiquement pour vos processus métier uniques." },
  { icon: Globe, title: "App Web", description: "Expériences web immersives et évolutives avec React, Next.js et architectures Cloud." },
  { icon: Smartphone, title: "App Mobile", description: "Développement iOS & Android natif et cross-platform axé sur la performance et l'UX." },
  { icon: MonitorCog, title: "Logiciels", description: "Applications bureau et systèmes embarqués pour des performances sans compromis." },
  { icon: Workflow, title: "Digitalisation", description: "Optimisation de vos flux de travail et automatisation intelligente de vos services." },
  { icon: TrendingUp, title: "Amélioration", description: "Audit, refactorisation et accélération de vos infrastructures technologiques existantes." },
];

export function Services({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const subtitle = section?.subtitle || DEFAULT_SUBTITLE;
  const ctaLabel = section?.cta_label || "Explorer tous les services";
  const ctaLink = section?.cta_link || "/expertise";
  const services: Service[] = section?.items?.length
    ? (section.items as { icon: string; title: string; description: string }[]).map((item) => ({
        icon: ICONS[item.icon] ?? LayoutGrid,
        title: item.title,
        description: item.description,
      }))
    : DEFAULT_SERVICES;

  return (
    <section id="expertise" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </div>
        <a
          href={ctaLink}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {ctaLabel}
          <span aria-hidden>→</span>
        </a>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.title}
            className="group rounded-2xl border border-white/10 bg-card/60 p-6 transition-colors hover:border-primary/30 hover:bg-card"
          >
            <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <service.icon className="size-5" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {service.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {service.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
