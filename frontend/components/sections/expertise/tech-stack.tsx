"use client";

import { motion } from "motion/react";
import type { PageSection } from "@/lib/api/types";

type Tech = { name: string; label: string; logo_url?: string };

const DEFAULT_TITLE = "Stack Technologique";
const DEFAULT_SUBTITLE = "Nous utilisons exclusivement des technologies de pointe, éprouvées pour leur performance et leur capacité à évoluer.";
const DEFAULT_STACK: Tech[] = [
  { name: "Next.js", label: "Frontend" },
  { name: "Python", label: "Django" },
  { name: "Docker", label: "DevOps" },
  { name: "PostgreSQL", label: "Database" },
  { name: "AWS", label: "Cloud" },
  { name: "Redis", label: "Caching" },
];

export function TechStack({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const subtitle = section?.subtitle || DEFAULT_SUBTITLE;
  const ctaLabel = section?.cta_label || "Standards Industriels";
  const ctaLink = section?.cta_link || "#contact";
  const stack: Tech[] = section?.items?.length ? (section.items as Tech[]) : DEFAULT_STACK;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
        >
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </motion.div>
        <a
          href={ctaLink}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {ctaLabel}
          <span aria-hidden>→</span>
        </a>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stack.map((tech, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const }}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-card/60 px-4 py-6 text-center transition-colors hover:border-primary/30"
          >
            {tech.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tech.logo_url} alt={tech.name} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-sm font-semibold text-foreground">{tech.name}</span>
            )}
            <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              {tech.label}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
