"use client";

import { motion } from "motion/react";
import { Mail } from "lucide-react";
import type { PageSection } from "@/lib/api/types";

type Member = {
  name: string;
  role: string;
  bio: string;
  photo_url?: string;
};

const DEFAULT_TITLE = "Notre Équipe";
const DEFAULT_SUBTITLE = "Les architectes, ingénieurs et experts sécurité qui conçoivent et livrent chacun de vos projets.";
const DEFAULT_TEAM: Member[] = [
  { name: "Dr. Elias Vance", role: "Architecte Sécurité", bio: "Pilote la stratégie de cybersécurité et l'architecture Zero Trust." },
  { name: "Sofia Ramirez", role: "Lead Frontend Engineer", bio: "Conçoit des interfaces temps réel pour les environnements haute fréquence." },
  { name: "Marc Dubois", role: "Architecte Cloud", bio: "Orchestre les infrastructures multi-cloud à grande échelle." },
  { name: "Léa Fontaine", role: "Ingénieure Sécurité", bio: "Sécurise les données sensibles et les architectures réglementées." },
  { name: "Taiger Dev", role: "Développeur Full Stack", bio: "Construit les briques techniques de nos solutions sur-mesure." },
];

function initials(name: string) {
  return name
    .replace("Dr. ", "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

export function Team({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const subtitle = section?.subtitle || DEFAULT_SUBTITLE;
  const team: Member[] = section?.items?.length ? (section.items as Member[]) : DEFAULT_TEAM;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
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

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {team.map((member, i) => (
          <motion.div
            key={member.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as const }}
            className="group rounded-2xl border border-white/10 bg-card/60 p-6 transition-colors hover:border-primary/30 hover:bg-card"
          >
            <div className="flex items-center justify-between">
              {member.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={member.photo_url} alt={member.name} className="size-12 rounded-full object-cover" />
              ) : (
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {initials(member.name)}
                </span>
              )}
              <a
                href={`mailto:${member.name
                  .toLowerCase()
                  .replace("dr. ", "")
                  .replace(" ", ".")}@sokensdigital.com`}
                aria-label={`Contacter ${member.name}`}
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-primary/40 hover:text-primary"
              >
                <Mail className="size-4" />
              </a>
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              {member.name}
            </h3>
            <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">
              {member.role}
            </span>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {member.bio}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
