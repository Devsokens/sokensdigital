"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, FileText, Mail, Phone, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  listSubmittedProjects,
  runWorkflowAction,
  type SubmittedProject,
  type WorkflowStage,
} from "@/lib/api/marketing";
import { listSpecifications } from "@/lib/api/marketing";
import type { SpecificationListItem } from "@/lib/api/types";
import { formatFcfa } from "@/lib/format-currency";
import { cn } from "@/lib/utils";

const STAGE_STYLES: Record<WorkflowStage, string> = {
  SOUMIS: "bg-amber-100 text-amber-700",
  CHEZ_TECHNIQUE: "bg-sky-100 text-sky-700",
  CDC_PRET: "bg-violet-100 text-violet-700",
  SOUMIS_CLIENT: "bg-blue-100 text-blue-700",
  VALIDE_CLIENT: "bg-emerald-100 text-emerald-700",
  EN_DEVELOPPEMENT: "bg-neutral-900 text-white",
};

/** L'action qui exige un cahier des charges. Le serveur la refuse sans, on
 * demande donc lequel joindre avant de l'envoyer plutôt que d'essuyer un
 * refus prévisible. */
const NEEDS_SPECIFICATION = "joindre_cdc";

/**
 * Projets soumis par le portail public, et leur parcours entre départements.
 *
 * Le même écran sert Marketing et Technique : le serveur ne renvoie à chacun
 * que les actions que son rôle autorise à l'étape courante. Deux composants
 * distincts auraient dupliqué la liste, les états et les libellés, avec le
 * risque qu'ils divergent sur ce qu'est une demande en cours.
 *
 * `stages` restreint l'affichage aux étapes qui concernent le département
 * depuis lequel l'écran est ouvert.
 */
export function SubmittedProjects({
  stages,
  title,
  subtitle,
}: {
  stages?: WorkflowStage[];
  title: string;
  subtitle: string;
}) {
  const [projects, setProjects] = useState<SubmittedProject[] | null>(null);
  const [specifications, setSpecifications] = useState<SpecificationListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [chosenSpec, setChosenSpec] = useState("");

  const load = useCallback(async () => {
    try {
      setProjects(await listSubmittedProjects(stages));
      setError(null);
    } catch {
      setError("Impossible de charger les projets soumis.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages?.join(",")]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    listSpecifications()
      .then((page) => setSpecifications(page.results))
      .catch(() => setSpecifications([]));
  }, []);

  async function act(project: SubmittedProject, action: string, specificationId?: string) {
    setBusyId(project.id);
    setError(null);
    try {
      await runWorkflowAction(project.id, action, specificationId);
      setPickerFor(null);
      setChosenSpec("");
      await load();
    } catch (err) {
      // Le serveur explique pourquoi il refuse — étape déjà avancée par
      // quelqu'un d'autre, cahier des charges manquant. Son message est plus
      // utile qu'un texte générique.
      const body = (err as { body?: Record<string, string[] | string> }).body;
      const detail =
        (typeof body?.detail === "string" && body.detail) ||
        (Array.isArray(body?.action) && body.action[0]) ||
        (Array.isArray(body?.specification_id) && body.specification_id[0]) ||
        "Action impossible sur cette demande.";
      setError(detail);
    } finally {
      setBusyId(null);
    }
  }

  if (!projects) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}

      {projects.length === 0 && (
        <p className="rounded-xl border border-dashed border-neutral-200 px-4 py-10 text-center text-sm text-neutral-400">
          Aucun projet à cette étape pour l&apos;instant.
        </p>
      )}

      <div className="space-y-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
                  {project.reference}
                </span>
                <h2 className="text-base font-semibold text-neutral-900">
                  {project.company_name || `${project.first_name} ${project.last_name}`}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Reçu le {new Date(project.created_at).toLocaleDateString("fr-FR")}
                  {project.estimated_value &&
                    ` · Budget estimé ${formatFcfa(project.estimated_value)}`}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                  STAGE_STYLES[project.workflow_stage],
                )}
              >
                {project.workflow_stage_display}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5 shrink-0" />
                {project.email}
              </span>
              {project.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" />
                  {project.phone}
                </span>
              )}
              {project.specification && (
                <span className="inline-flex items-center gap-1.5 text-neutral-700">
                  <FileText className="size-3.5 shrink-0" />
                  {project.specification.spec_number} — {project.specification.title}
                </span>
              )}
            </div>

            {project.message && (
              <p className="mt-3 line-clamp-4 rounded-lg bg-neutral-50 px-3 py-2.5 text-xs whitespace-pre-wrap text-neutral-600">
                {project.message}
              </p>
            )}

            {pickerFor === project.id ? (
              <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3.5">
                <label className="block">
                  <span className={labelClass}>Cahier des charges à joindre</span>
                  <select
                    value={chosenSpec}
                    onChange={(e) => setChosenSpec(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Choisir un cahier des charges…</option>
                    {specifications.map((spec) => (
                      <option key={spec.id} value={spec.id}>
                        {spec.spec_number} — {spec.title}
                      </option>
                    ))}
                  </select>
                </label>
                {specifications.length === 0 && (
                  <p className="mt-2 text-xs text-neutral-500">
                    Aucun cahier des charges enregistré — il faut d&apos;abord en créer un.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={!chosenSpec || busyId === project.id}
                    onClick={() => act(project, NEEDS_SPECIFICATION, chosenSpec)}
                    className="gap-1.5 rounded-full px-4"
                  >
                    {busyId === project.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    Transmettre au marketing
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPickerFor(null);
                      setChosenSpec("");
                    }}
                    className="rounded-full px-4"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            ) : (
              project.available_actions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.available_actions.map((action) => (
                    <Button
                      key={action.action}
                      type="button"
                      disabled={busyId === project.id}
                      variant={action.action === "renvoyer_technique" ? "outline" : "default"}
                      onClick={() =>
                        action.action === NEEDS_SPECIFICATION
                          ? setPickerFor(project.id)
                          : act(project, action.action)
                      }
                      className="gap-1.5 rounded-full px-4"
                    >
                      {busyId === project.id && <Loader2 className="size-4 animate-spin" />}
                      {action.label}
                    </Button>
                  ))}
                </div>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
