"use client";

import { motion } from "motion/react";
import { Check, ShieldCheck, Rocket, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProjectFormData } from "@/components/sections/start-project/types";

const OBJECTIF_LABELS: Record<string, string> = {
  transformation: "Transformation Digitale",
  logiciel: "Logiciel Sur-Mesure",
  audit: "Audit Cybersécurité",
};

const NEXT_STEPS = [
  {
    title: "Analyse technique approfondie",
    description:
      "Nos ingénieurs examinent vos spécifications pour valider la faisabilité technique.",
  },
  {
    title: "Session de cadrage (Workshop)",
    description:
      "Un consultant senior vous contactera pour planifier un appel de 45 minutes.",
  },
  {
    title: "Proposition finale & Kick-off",
    description:
      "Validation du devis détaillé et lancement de la phase de développement agile.",
  },
];

export function StepSuccess({
  data,
  reference,
}: {
  data: ProjectFormData;
  reference: string;
}) {
  const conceptTitle = data.objectif ? OBJECTIF_LABELS[data.objectif] : "Votre Projet";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto max-w-2xl text-center"
    >
      <div className="mx-auto flex size-20 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary shadow-[0_0_40px_-8px_color-mix(in_oklch,var(--primary),transparent_40%)]">
        <Check className="size-9" />
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Demande Envoyée avec Succès !
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
        Merci de nous avoir fait confiance. Nos experts analysent déjà votre
        projet pour définir la stratégie technologique la plus performante.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-[1fr_16rem]">
        <div className="rounded-2xl border border-primary/40 bg-primary/[0.04] p-5">
          <span className="text-xs font-semibold tracking-[0.1em] text-primary uppercase">
            Récapitulatif
          </span>
          <p className="mt-1 text-lg font-semibold text-foreground">{conceptTitle}</p>
          <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
            <div>
              <span className="block text-xs text-muted-foreground">Référence</span>
              <span className="block text-sm font-semibold text-foreground">{reference}</span>
              <span className="block text-[11px] text-muted-foreground">
                Gardez ce code pour le suivi
              </span>
            </div>
            <div className="text-right">
              <span className="block text-xs text-muted-foreground">Délai estimé</span>
              <span className="block text-sm font-semibold text-foreground">
                Moins de 24 heures
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
          <ShieldCheck className="size-5 text-primary" />
          <p className="mt-2 text-sm font-semibold text-foreground">Statut : Sécurisé</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Votre demande a été cryptée et transmise à notre cellule
            d&apos;analyse.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-card/60 p-6 text-left">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Rocket className="size-4 text-primary" />
          Prochaines Étapes
        </h3>
        <ol className="mt-4 space-y-4">
          {NEXT_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{step.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          render={<a href="/">Retour à l&apos;Accueil</a>}
          nativeButton={false}
          className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        />
        <Button
          render={
            <a href="/suivi-projet" className="inline-flex items-center justify-center gap-2">
              <RotateCw className="size-4" />
              Suivre l&apos;avancement avec mon code
            </a>
          }
          nativeButton={false}
          variant="outline"
          className="h-11 flex-1 rounded-lg border-white/15 bg-transparent text-sm font-semibold text-foreground hover:bg-white/5"
        />
        <Button
          render={
            <a href="/#blog" className="inline-flex items-center justify-center gap-2">
              <Sparkles className="size-4" />
              Consulter nos Insights
            </a>
          }
          nativeButton={false}
          variant="outline"
          className="h-11 flex-1 rounded-lg border-white/15 bg-transparent text-sm font-semibold text-primary hover:bg-white/5"
        />
      </div>
    </motion.div>
  );
}
