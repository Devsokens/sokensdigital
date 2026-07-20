"use client";

import { motion } from "motion/react";

const STACK = [
  { name: "Next.js", label: "Frontend" },
  { name: "Python", label: "Django" },
  { name: "Docker", label: "DevOps" },
  { name: "PostgreSQL", label: "Database" },
  { name: "AWS", label: "Cloud" },
  { name: "Redis", label: "Caching" },
];

export function TechStack() {
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
            Stack Technologique
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
            Nous utilisons exclusivement des technologies de pointe, éprouvées
            pour leur performance et leur capacité à évoluer.
          </p>
        </motion.div>
        <a
          href="#contact"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Standards Industriels
          <span aria-hidden>→</span>
        </a>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {STACK.map((tech, i) => (
          <motion.div
            key={tech.name}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const }}
            className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-card/60 px-4 py-6 text-center transition-colors hover:border-primary/30"
          >
            <span className="text-sm font-semibold text-foreground">{tech.name}</span>
            <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              {tech.label}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
