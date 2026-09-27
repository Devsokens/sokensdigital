"use client";

import { motion } from "motion/react";
import { Puzzle, Smartphone, Monitor, Cpu, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageSection } from "@/lib/api/types";

const EASE = [0.16, 1, 0.3, 1] as const;

type Service = {
  icon?: string;
  title: string;
  description: string;
};

const DEFAULT_TITLE = "Ingénierie de Précision";
const DEFAULT_SUBTITLE =
  "Notre arsenal technologique est conçu pour répondre aux défis les plus complexes de l'industrie numérique.";

const DEFAULT_SERVICES: Service[] = [
  {
    icon: "layout-grid",
    title: "Solutions sur Mesure",
    description: "Architecture logicielle robuste conçue spécifiquement pour vos processus métier uniques.",
  },
  {
    icon: "globe",
    title: "App Web",
    description: "Expériences web immersives et évolutives avec React, Next.js et architectures Cloud.",
  },
  {
    icon: "smartphone",
    title: "App Mobile",
    description: "Développement iOS & Android natif et cross-platform axé sur la performance et l'UX.",
  },
  {
    icon: "monitor-cog",
    title: "Logiciels",
    description: "Applications bureau et systèmes embarqués pour des performances sans compromis.",
  },
  {
    icon: "workflow",
    title: "Digitalisation",
    description: "Optimisation de vos flux de travail et automatisation intelligente de vos services.",
  },
  {
    icon: "trending-up",
    title: "Amélioration",
    description: "Audit, refactorisation et accélération de vos infrastructures technologiques existantes.",
  },
];

/* =========================================================================
   1. VISUEL ARCHITECTURE / WORKFLOW (Solutions sur Mesure)
   ========================================================================= */
function SolutionsVisual() {
  return (
    <div className="relative flex h-full min-h-[180px] w-full items-center justify-center p-3">
      <div className="absolute size-40 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative z-10 w-full max-w-[260px] rounded-2xl border border-white/10 bg-card p-4 shadow-lg transition-all duration-500 group-hover:border-primary/40 group-hover:shadow-primary/10 group-hover:-translate-y-1">
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-background/80 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Vérifié
          </span>
          <span className="text-[10px] text-muted-foreground">Architecture</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Puzzle className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" />
              <span className="text-[10px] font-semibold text-primary uppercase">Sur-mesure</span>
            </div>
            <p className="truncate text-xs font-semibold text-foreground">Modèle Entreprise</p>
            <p className="text-[10px] text-muted-foreground">Temps réel & Sécurisé</p>
          </div>
        </div>

        <div className="pointer-events-none absolute -bottom-2 -right-1 text-primary transition-transform duration-500 group-hover:translate-x-1 group-hover:translate-y-1">
          <svg className="size-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 2l14.5 7.5-6.5 2-2 6.5L4 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   2. VISUEL ÉCOSYSTÈME WEB & CLOUD (App Web)
   ========================================================================= */
function ReactIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-11.5 -10.23174 23 20.46348">
      <circle cx="0" cy="0" r="2.05" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1" fill="none">
        <ellipse rx="11" ry="4.2" />
        <ellipse rx="11" ry="4.2" transform="rotate(60)" />
        <ellipse rx="11" ry="4.2" transform="rotate(120)" />
      </g>
    </svg>
  );
}

function HexagonTile({
  cx,
  cy,
  r = 34,
  glow = false,
  children,
}: {
  cx: number;
  cy: number;
  r?: number;
  glow?: boolean;
  children?: React.ReactNode;
}) {
  const points = Array.from({ length: 6 })
    .map((_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    })
    .join(" ");

  return (
    <g className="transition-transform duration-300">
      <polygon
        points={points}
        className={cn(
          "transition-all duration-500",
          glow
            ? "fill-primary/10 stroke-primary/50 group-hover:stroke-primary"
            : "fill-card/80 stroke-white/10 group-hover:stroke-white/20"
        )}
        strokeWidth="1.2"
      />
      {children}
    </g>
  );
}

function EcosystemVisual() {
  return (
    <div className="relative flex h-full min-h-[180px] w-full items-center justify-center overflow-hidden p-2">
      <div className="absolute size-48 rounded-full bg-primary/10 blur-3xl" />

      <svg viewBox="0 0 500 200" className="h-full max-h-[190px] w-full max-w-[500px] select-none text-primary">
        <HexagonTile cx={90} cy={40} r={32} />
        <HexagonTile cx={190} cy={40} r={32} glow>
          <foreignObject x={174} y={24} width={32} height={32}>
            <div className="flex size-full items-center justify-center text-xs font-bold text-foreground">
              Next
            </div>
          </foreignObject>
        </HexagonTile>
        <HexagonTile cx={290} cy={40} r={32} />
        <HexagonTile cx={390} cy={40} r={32} glow>
          <foreignObject x={374} y={24} width={32} height={32}>
            <div className="flex size-full items-center justify-center text-xs font-semibold text-primary">
              TS
            </div>
          </foreignObject>
        </HexagonTile>

        <HexagonTile cx={45} cy={100} r={32} />
        <HexagonTile cx={140} cy={100} r={32} glow>
          <foreignObject x={124} y={84} width={32} height={32}>
            <div className="flex size-full items-center justify-center text-xs font-semibold text-primary">
              Py
            </div>
          </foreignObject>
        </HexagonTile>
        <HexagonTile cx={240} cy={100} r={36} glow>
          <foreignObject x={222} y={82} width={36} height={36}>
            <div className="flex size-full items-center justify-center text-primary">
              <ReactIcon className="size-7 transition-transform duration-700 group-hover:rotate-180" />
            </div>
          </foreignObject>
        </HexagonTile>
        <HexagonTile cx={340} cy={100} r={32} />
        <HexagonTile cx={440} cy={100} r={32} glow>
          <foreignObject x={424} y={84} width={32} height={32}>
            <div className="flex size-full items-center justify-center text-xs font-semibold text-foreground">
              Cloud
            </div>
          </foreignObject>
        </HexagonTile>

        <HexagonTile cx={90} cy={160} r={32} />
        <HexagonTile cx={190} cy={160} r={32} />
        <HexagonTile cx={290} cy={160} r={32} glow />
        <HexagonTile cx={390} cy={160} r={32} />
      </svg>
    </div>
  );
}

/* =========================================================================
   3. VISUEL APP MOBILE
   ========================================================================= */
function MobileVisual() {
  return (
    <div className="relative flex h-full min-h-[140px] w-full items-center justify-center p-3">
      <div className="absolute size-28 rounded-full bg-primary/10 blur-xl" />
      <div className="relative z-10 flex h-28 w-20 flex-col justify-between rounded-2xl border border-white/10 bg-card p-2 shadow-md transition-transform duration-500 group-hover:scale-105 group-hover:border-primary/40">
        <div className="flex justify-center">
          <div className="h-1 w-6 rounded-full bg-white/20" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-1">
          <Smartphone className="size-6 text-primary" />
          <span className="text-[8px] font-semibold text-foreground">iOS & Android</span>
        </div>
        <div className="flex justify-center">
          <div className="size-2 rounded-full border border-white/20" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. VISUEL LOGICIELS
   ========================================================================= */
function LogicielsVisual() {
  return (
    <div className="relative flex h-full min-h-[140px] w-full items-center justify-center p-3">
      <div className="absolute size-28 rounded-full bg-primary/10 blur-xl" />
      <div className="relative z-10 w-full max-w-[150px] rounded-xl border border-white/10 bg-card p-3 shadow-md transition-transform duration-500 group-hover:scale-105 group-hover:border-primary/40">
        <div className="mb-2 flex items-center justify-between border-b border-white/10 pb-1.5">
          <div className="flex gap-1">
            <span className="size-1.5 rounded-full bg-rose-500/80" />
            <span className="size-1.5 rounded-full bg-amber-500/80" />
            <span className="size-1.5 rounded-full bg-emerald-500/80" />
          </div>
          <Monitor className="size-3 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <div className="h-1.5 w-full rounded-full bg-primary/20" />
          <div className="h-1.5 w-3/4 rounded-full bg-primary/40" />
          <div className="h-1.5 w-1/2 rounded-full bg-white/15" />
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   5. VISUEL DIGITALISATION (Radar / Flux)
   ========================================================================= */
function DigitalisationVisual() {
  return (
    <div className="relative flex h-full min-h-[140px] w-full items-center justify-center overflow-hidden p-3">
      <div className="absolute size-28 rounded-full bg-primary/10 blur-xl" />
      <div className="pointer-events-none absolute size-36 rounded-3xl border border-primary/10 transition-transform duration-700 group-hover:scale-105" />
      <div className="pointer-events-none absolute size-24 rounded-2xl border border-primary/25 transition-transform duration-700 group-hover:scale-105 group-hover:border-primary/40" />
      <div className="relative z-10 flex size-11 items-center justify-center rounded-xl bg-card border border-primary/40 text-primary shadow-md transition-transform duration-500 group-hover:scale-110">
        <Cpu className="size-5" />
      </div>
    </div>
  );
}

/* =========================================================================
   6. VISUEL AMÉLIORATION (Performance / Courbe)
   ========================================================================= */
function ImprovementVisual() {
  return (
    <div className="relative flex h-full min-h-[140px] w-full items-center justify-center p-3">
      <div className="absolute size-28 rounded-full bg-primary/10 blur-xl" />
      <div className="relative z-10 w-full max-w-[150px]">
        <svg viewBox="0 0 160 90" className="w-full">
          <path
            d="M 10 75 Q 45 70, 75 50 T 130 20 T 150 15"
            fill="none"
            stroke="var(--color-primary, currentColor)"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-primary"
          />
          <circle cx="150" cy="15" r="4" fill="var(--color-primary, currentColor)" className="text-primary" />
          <line x1="150" y1="15" x2="150" y2="85" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="2 2" className="text-primary" />
        </svg>
        <div className="mt-1 flex items-center justify-between text-[9px] text-muted-foreground">
          <span>Audit</span>
          <span className="flex items-center text-primary font-semibold">
            <TrendingUp className="size-2.5 mr-0.5" /> +99.9%
          </span>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN SERVICES COMPONENT
   ========================================================================= */
export function Services({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const subtitle = section?.subtitle || DEFAULT_SUBTITLE;
  const ctaLabel = section?.cta_label || "Explorer tous les services";
  const ctaLink = section?.cta_link || "/expertise";
  const services: Service[] = section?.items?.length
    ? (section.items as Service[])
    : DEFAULT_SERVICES;

  // Garantit la correspondance des 6 services
  const svc0 = services[0] || DEFAULT_SERVICES[0];
  const svc1 = services[1] || DEFAULT_SERVICES[1];
  const svc2 = services[2] || DEFAULT_SERVICES[2];
  const svc3 = services[3] || DEFAULT_SERVICES[3];
  const svc4 = services[4] || DEFAULT_SERVICES[4];
  const svc5 = services[5] || DEFAULT_SERVICES[5];

  return (
    <section id="expertise" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      {/* En-tête de la section */}
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

      {/* Grille Bento asymétrique adaptée aux 6 services et à la charte */}
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        {/* CARTE 1 : Solutions sur Mesure (5 colonnes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-6 transition-all duration-500 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/10 sm:p-7 lg:col-span-5"
        >
          <SolutionsVisual />
          <div className="mt-4">
            <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary sm:text-lg">
              {svc0.title}
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed sm:text-sm">
              {svc0.description}
            </p>
          </div>
        </motion.div>

        {/* CARTE 2 : App Web (7 colonnes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-6 transition-all duration-500 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/10 sm:p-7 lg:col-span-7"
        >
          <EcosystemVisual />
          <div className="mt-4">
            <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary sm:text-lg">
              {svc1.title}
            </h3>
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed sm:text-sm">
              {svc1.description}
            </p>
          </div>
        </motion.div>

        {/* CARTE 3 : App Mobile (3 colonnes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.2, ease: EASE }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-5 transition-all duration-500 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/10 lg:col-span-3"
        >
          <MobileVisual />
          <div className="mt-3">
            <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
              {svc2.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {svc2.description}
            </p>
          </div>
        </motion.div>

        {/* CARTE 4 : Logiciels (3 colonnes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.3, ease: EASE }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-5 transition-all duration-500 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/10 lg:col-span-3"
        >
          <LogicielsVisual />
          <div className="mt-3">
            <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
              {svc3.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {svc3.description}
            </p>
          </div>
        </motion.div>

        {/* CARTE 5 : Digitalisation (3 colonnes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-5 transition-all duration-500 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/10 lg:col-span-3"
        >
          <DigitalisationVisual />
          <div className="mt-3">
            <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
              {svc4.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {svc4.description}
            </p>
          </div>
        </motion.div>

        {/* CARTE 6 : Amélioration (3 colonnes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5, delay: 0.5, ease: EASE }}
          className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-5 transition-all duration-500 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/10 lg:col-span-3"
        >
          <ImprovementVisual />
          <div className="mt-3">
            <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-primary">
              {svc5.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {svc5.description}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
