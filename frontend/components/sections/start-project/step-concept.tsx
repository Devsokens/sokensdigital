"use client";

import { User, Lightbulb, ShieldCheck, Rocket, SquareTerminal, Shield } from "lucide-react";
import { RadioCard } from "@/components/sections/start-project/radio-card";
import type { ProjectFormData, Objectif } from "@/components/sections/start-project/types";

const OBJECTIFS: { key: Objectif; icon: typeof Rocket; title: string; description: string }[] = [
  {
    key: "transformation",
    icon: Rocket,
    title: "Transformation Digitale",
    description: "Modernisez vos processus internes et votre stack technologique.",
  },
  {
    key: "logiciel",
    icon: SquareTerminal,
    title: "Logiciel Sur-Mesure",
    description:
      "Conception et développement d'applications critiques hautes performances.",
  },
  {
    key: "audit",
    icon: Shield,
    title: "Audit Cybersécurité",
    description: "Évaluation des vulnérabilités et renforcement de l'infrastructure.",
  },
];

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/50 focus:outline-none";

type Props = {
  data: ProjectFormData;
  update: (patch: Partial<ProjectFormData>) => void;
};

export function StepConcept({ data, update }: Props) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-card/60 p-6 sm:p-7">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <User className="size-5 text-primary" />
            Informations Personnelles
          </h3>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Prénom</span>
              <input
                type="text"
                value={data.prenom}
                onChange={(e) => update({ prenom: e.target.value })}
                placeholder="Enock"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Nom</span>
              <input
                type="text"
                value={data.nom}
                onChange={(e) => update({ nom: e.target.value })}
                placeholder="Mboumba"
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Email Professionnel
              </span>
              <input
                type="email"
                value={data.email}
                onChange={(e) => update({ email: e.target.value })}
                placeholder="mboumba@gmail.com"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Entreprise</span>
              <input
                type="text"
                value={data.entreprise}
                onChange={(e) => update({ entreprise: e.target.value })}
                placeholder="Nom de la société"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Secteur d&apos;activité
              </span>
              <input
                type="text"
                value={data.secteur}
                onChange={(e) => update({ secteur: e.target.value })}
                placeholder="Comptabilité"
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card/60 p-6 sm:p-7">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Lightbulb className="size-5 text-primary" />
            Objectif du Projet
          </h3>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {OBJECTIFS.map((obj) => (
              <RadioCard
                key={obj.key}
                icon={obj.icon}
                title={obj.title}
                description={obj.description}
                selected={data.objectif === obj.key}
                onSelect={() => update({ objectif: obj.key })}
              />
            ))}
          </div>
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-primary/40 bg-primary/[0.04] p-5">
        <span className="text-xs font-semibold tracking-[0.1em] text-primary uppercase">
          Précision Soken
        </span>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Vos données sont traitées avec le plus haut niveau de confidentialité.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Données chiffrées (AES-256)
        </p>
      </aside>
    </div>
  );
}
