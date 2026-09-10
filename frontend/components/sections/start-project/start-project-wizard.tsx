"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stepper, type StepKey } from "@/components/sections/start-project/stepper";
import { StepConcept } from "@/components/sections/start-project/step-concept";
import { StepTechnique } from "@/components/sections/start-project/step-technique";
import { StepLogistique } from "@/components/sections/start-project/step-logistique";
import { StepSuccess } from "@/components/sections/start-project/step-success";
import type {
  ProjectFormData,
  ObjectifOption,
  SolutionOption,
  DelaiOption,
  CanalOption,
} from "@/components/sections/start-project/types";
import { createLead, uploadLeadAttachment } from "@/lib/api/public";

function buildLeadPayload(data: ProjectFormData) {
  const notes = [
    data.objectif && `Objectif : ${data.objectif}`,
    data.secteur && `Secteur d'activité : ${data.secteur}`,
    `Type de solution : ${data.typeSolution}`,
    `Délai souhaité : ${data.delai}`,
    `Canal privilégié : ${data.canal}`,
    `NDA demandé : ${data.nda ? "Oui" : "Non"}`,
    data.description && `\nCahier des charges :\n${data.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    first_name: data.prenom,
    last_name: data.nom,
    email: data.email,
    phone: data.telephone,
    company_name: data.entreprise,
    source: "FORMULAIRE_DEVIS" as const,
    message: notes,
    estimated_value: data.budget || undefined,
  };
}

const FORM_STEPS: StepKey[] = ["concept", "technique", "logistique"];

const STEP_COPY: Record<StepKey, { title: string; subtitle: string }> = {
  concept: {
    title: "Démarrer un Projet",
    subtitle: "Étape 1 : Parlez-nous de vous et de votre vision.",
  },
  technique: {
    title: "Démarrer un Projet",
    subtitle: "Étape 2 : Définissez vos objectifs et vos ressources.",
  },
  logistique: {
    title: "Démarrer un Projet",
    subtitle:
      "Configurez les derniers détails logistiques pour que nos équipes puissent commencer le déploiement de votre solution.",
  },
  validation: { title: "", subtitle: "" },
};

type Props = {
  objectifs: ObjectifOption[];
  solutions: SolutionOption[];
  delais: DelaiOption[];
  canaux: CanalOption[];
};

export function StartProjectWizard({ objectifs, solutions, delais, canaux }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [data, setData] = useState<ProjectFormData>(() => ({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    entreprise: "",
    secteur: "",
    objectif: null,
    typeSolution: solutions[0]?.label ?? "",
    budget: "",
    description: "",
    delai: delais[0]?.title ?? "",
    canal: canaux[0]?.label ?? "",
    nda: false,
    attachment: null,
  }));
  // Non-bloquant : la demande est déjà enregistrée quand cet upload part,
  // un échec ici ne doit pas empêcher le client de voir sa confirmation.
  const [attachmentWarning, setAttachmentWarning] = useState<string | null>(null);
  // Attribuée par le serveur à l'enregistrement. Elle était jusqu'ici
  // tirée au hasard dans le navigateur : le client notait une référence
  // qui n'existait nulle part, et le suivi ne pouvait rien en faire.
  const [reference, setReference] = useState("");

  const update = (patch: Partial<ProjectFormData>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const currentKey: StepKey = submitted ? "validation" : FORM_STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === FORM_STEPS.length - 1;

  const goNext = async () => {
    if (isLast) {
      setSubmitError(null);
      setSubmitting(true);
      try {
        const created = await createLead(buildLeadPayload(data));
        setReference(created.tracking_reference);
        if (data.attachment) {
          try {
            await uploadLeadAttachment(created.tracking_reference, data.email, data.attachment);
          } catch {
            // La demande est déjà créée et confirmée par e-mail — un échec
            // d'upload ne doit pas bloquer la confirmation, juste prévenir.
            setAttachmentWarning(
              "Votre demande a bien été envoyée, mais le fichier joint n'a pas pu être transmis. Vous pourrez le renvoyer par e-mail.",
            );
          }
        }
        setSubmitted(true);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Impossible d'envoyer la demande.");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    setStepIndex((i) => Math.min(i + 1, FORM_STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goPrev = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (submitted) {
    return (
      <section className="mx-auto max-w-5xl px-4 pt-32 pb-24 sm:px-6 sm:pt-40 lg:px-8">
        <StepSuccess data={data} reference={reference} />
        {attachmentWarning && (
          <p className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600">
            {attachmentWarning}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 pt-32 pb-24 sm:px-6 sm:pt-40 lg:px-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {STEP_COPY[currentKey].title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            {STEP_COPY[currentKey].subtitle}
          </p>
        </div>
        <a
          href="/suivi-projet"
          className="shrink-0 text-sm font-medium text-foreground underline decoration-white/30 underline-offset-4 hover:text-primary hover:decoration-primary"
        >
          Suivre un projet
        </a>
      </div>

      <div className="mt-10">
        <Stepper current={currentKey} />
      </div>

      <div className="mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] as const }}
          >
            {currentKey === "concept" && <StepConcept data={data} update={update} objectifs={objectifs} />}
            {currentKey === "technique" && <StepTechnique data={data} update={update} solutions={solutions} />}
            {currentKey === "logistique" && <StepLogistique data={data} update={update} delais={delais} canaux={canaux} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {submitError && (
        <p className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      <div className="mt-10 flex items-center justify-between">
        {isFirst ? (
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Annuler
          </a>
        ) : (
          <button
            type="button"
            onClick={goPrev}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground uppercase hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Précédent
          </button>
        )}

        <Button
          onClick={goNext}
          disabled={submitting}
          size="lg"
          className={
            isLast
              ? "h-12 rounded-lg bg-primary px-7 text-sm font-semibold tracking-wide text-primary-foreground uppercase shadow-[0_0_30px_-6px_color-mix(in_oklch,var(--primary),transparent_30%)] hover:bg-primary/90 disabled:opacity-60"
              : "h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          }
        >
          <span className="inline-flex items-center gap-2">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              <>
                {isLast ? "Soumettre le Projet" : "Suivant"}
                <ArrowRight className="size-4" />
              </>
            )}
          </span>
        </Button>
      </div>
    </section>
  );
}
