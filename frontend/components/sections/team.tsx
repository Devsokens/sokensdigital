"use client";

import { motion } from "motion/react";
import { Mail } from "lucide-react";

type Member = {
  name: string;
  role: string;
  bio: string;
};

const TEAM: Member[] = [
  {
    name: "Dr. Elias Vance",
    role: "Architecte Sécurité",
    bio: "Pilote la stratégie de cybersécurité et l'architecture Zero Trust.",
  },
  {
    name: "Sofia Ramirez",
    role: "Lead Frontend Engineer",
    bio: "Conçoit des interfaces temps réel pour les environnements haute fréquence.",
  },
  {
    name: "Marc Dubois",
    role: "Architecte Cloud",
    bio: "Orchestre les infrastructures multi-cloud à grande échelle.",
  },
  {
    name: "Léa Fontaine",
    role: "Ingénieure Sécurité",
    bio: "Sécurise les données sensibles et les architectures réglementées.",
  },
  {
    name: "Taiger Dev",
    role: "Développeur Full Stack",
    bio: "Construit les briques techniques de nos solutions sur-mesure.",
  },
];

function initials(name: string) {
  return name
    .replace("Dr. ", "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

export function Team() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Notre Équipe
        </h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground sm:text-base">
          Les architectes, ingénieurs et experts sécurité qui conçoivent et
          livrent chacun de vos projets.
        </p>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM.map((member, i) => (
          <motion.div
            key={member.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="group rounded-2xl border border-white/10 bg-card/60 p-6 transition-colors hover:border-primary/30 hover:bg-card"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {initials(member.name)}
              </span>
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
