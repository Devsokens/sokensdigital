"use client";

import { Clock, Mail, Video, MessageSquare, Phone, BarChart3, Headset, ExternalLink } from "lucide-react";
import { RadioCard } from "@/components/sections/start-project/radio-card";
import { cn } from "@/lib/utils";
import type {
  ProjectFormData,
  Delai,
  Canal,
} from "@/components/sections/start-project/types";

const DELAIS: { key: Delai; title: string; subtitle: string }[] = [
  { key: "express", title: "Express", subtitle: "Moins d'un mois" },
  { key: "standard", title: "Standard", subtitle: "2 à 3 mois" },
  { key: "etendue", title: "Étendue", subtitle: "Plus de 4 mois" },
];

const DELAI_LABELS: Record<Delai, string> = {
  express: "Express (< 1 mois)",
  standard: "Standard (2-3 mois)",
  etendue: "Étendue (4+ mois)",
};

const CANAUX: { key: Canal; icon: typeof Mail; label: string }[] = [
  { key: "email", icon: Mail, label: "Email" },
  { key: "video", icon: Video, label: "Vidéo" },
  { key: "slack", icon: MessageSquare, label: "Slack" },
  { key: "appel", icon: Phone, label: "Appel" },
];

const OBJECTIF_LABELS: Record<string, string> = {
  transformation: "Transformation Digitale",
  logiciel: "Logiciel Sur-Mesure",
  audit: "Audit Cybersécurité",
};

type Props = {
  data: ProjectFormData;
  update: (patch: Partial<ProjectFormData>) => void;
};

export function StepLogistique({ data, update }: Props) {
  const conceptTitle = data.objectif ? OBJECTIF_LABELS[data.objectif] : "Votre Projet";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="rounded-2xl border border-white/10 bg-card/60 p-6 sm:p-7">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Clock className="size-5 text-primary" />
          Détails Logistiques
        </h3>

        <div className="mt-6">
          <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Délai souhaité pour le lancement
          </span>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DELAIS.map((d) => (
              <RadioCard
                key={d.key}
                icon={Clock}
                title={d.title}
                description={d.subtitle}
                selected={data.delai === d.key}
                onSelect={() => update({ delai: d.key })}
                compact
              />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Canal de communication privilégié
          </span>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CANAUX.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => update({ canal: c.key })}
                aria-pressed={data.canal === c.key}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors",
                  data.canal === c.key
                    ? "border-primary/60 bg-primary/5 text-primary"
                    : "border-white/10 bg-white/[0.02] text-foreground/80 hover:border-white/20"
                )}
              >
                <c.icon className="size-5" />
                <span className="text-[11px] font-semibold tracking-[0.1em] uppercase">
                  {c.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <input
            type="checkbox"
            checked={data.nda}
            onChange={(e) => update({ nda: e.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-primary"
          />
          <span>
            <span className="block text-sm font-medium text-foreground">
              Accord de Confidentialité (NDA)
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
              J&apos;accepte les conditions de confidentialité de Soken&apos;s
              Digital pour protéger les données stratégiques échangées.
            </span>
          </span>
        </label>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-primary/40 bg-primary/[0.04] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-[0.1em] text-primary uppercase">
              Résumé de la configuration
            </span>
            <BarChart3 className="size-4 text-primary" />
          </div>

          <div className="mt-4">
            <span className="text-[11px] text-muted-foreground uppercase">Concept</span>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{conceptTitle}</p>
            {data.secteur && (
              <p className="text-xs text-muted-foreground">{data.secteur}</p>
            )}
          </div>

          <div className="mt-4">
            <span className="text-[11px] text-muted-foreground uppercase">Technique</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium tracking-wide text-foreground uppercase">
                {data.typeSolution}
              </span>
              {data.budget && (
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-medium tracking-wide text-foreground uppercase">
                  {data.budget} €
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.06] p-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary uppercase">
              <span className="size-1.5 rounded-full bg-primary" />
              Logistique en cours
            </span>
            <div className="mt-2 space-y-1 text-xs">
              <p className="flex justify-between text-muted-foreground">
                Délai :
                <span className="font-medium text-foreground">{DELAI_LABELS[data.delai]}</span>
              </p>
              <p className="flex justify-between text-muted-foreground">
                Contact :
                <span className="font-medium text-foreground capitalize">{data.canal}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Headset className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground">
                Besoin d&apos;accompagnement ?
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Nos directeurs de projet sont à votre disposition pour
                affiner votre planning opérationnel.
              </p>
              <a
                href="#contact"
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Planifier un conseil
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
