"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  Check,
  BarChart3,
  Compass,
  FileSignature,
  Rocket,
  Calendar,
  Mail,
  Phone,
  Search,
  Loader2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  trackProject,
  trackProjectByToken,
  TrackingError,
  type ProjectTracking,
} from "@/lib/api/public";
import { cn } from "@/lib/utils";

/** Icônes des étapes, dans l'ordre de `Lead.TRACKING_STEPS` côté serveur.
 * Le serveur décide des étapes et de leur état ; on n'ajoute ici que leur
 * représentation, pour que l'ajout d'une étape ne demande pas de redéployer
 * deux listes qui se contredisent en attendant. */
const STEP_ICONS: LucideIcon[] = [Check, BarChart3, Compass, FileSignature, Rocket];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Suivi d'une demande de projet.
 *
 * Cet écran affichait auparavant une maquette : une référence inventée, un
 * projet fictif, des étapes figées et un bouton menant à « # ». Il interroge
 * désormais l'API — soit par le lien reçu par e-mail (`?t=<jeton>`), soit par
 * la référence et l'adresse du demandeur.
 */
export function ProjectStatusCard() {
  const searchParams = useSearchParams();
  const token = searchParams.get("t");

  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [tracking, setTracking] = useState<ProjectTracking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadByToken = useCallback(async (value: string) => {
    setLoading(true);
    setError(null);
    try {
      setTracking(await trackProjectByToken(value));
    } catch (err) {
      setError(
        err instanceof TrackingError
          ? err.message
          : "Le suivi est momentanément indisponible.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Le lien de l'e-mail ouvre directement le suivi : demander la référence à
  // quelqu'un qui vient de cliquer sur « Suivre ma demande » lui ferait
  // ressaisir ce que le lien contient déjà.
  useEffect(() => {
    if (token) loadByToken(token);
  }, [token, loadByToken]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setTracking(await trackProject(reference.trim(), email.trim()));
    } catch (err) {
      setTracking(null);
      setError(
        err instanceof TrackingError
          ? err.message
          : "Le suivi est momentanément indisponible.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 pb-8 sm:px-6 lg:px-8">
      {!tracking && (
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
          className="rounded-2xl border border-white/10 bg-card/60 p-6 sm:p-8"
        >
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
            Suivre ma demande
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Saisis la référence reçue par e-mail et l&apos;adresse utilisée lors de ta
            demande.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Référence</span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="SKN-2026-0042"
                required
                autoComplete="off"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Adresse e-mail
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
              />
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="mt-6 h-11 gap-2 rounded-lg bg-foreground px-5 text-sm font-semibold text-background hover:bg-foreground/90"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Consulter l&apos;avancement
          </Button>
        </motion.form>
      )}

      {tracking && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] as const }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-card/60"
        >
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-primary uppercase">
                Référence : {tracking.reference}
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    tracking.is_closed ? "bg-muted-foreground" : "bg-emerald-400",
                  )}
                />
              </span>
              <h2 className="mt-2 text-2xl font-semibold break-words text-foreground sm:text-3xl">
                {tracking.project_name}
              </h2>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
              {tracking.state_label}
            </span>
          </div>

          <div className="border-t border-white/10 px-6 py-8 sm:px-8">
            <div className="flex items-start overflow-x-auto pb-1 sm:overflow-visible">
              {tracking.steps.map((step, i) => {
                const Icon = STEP_ICONS[i] ?? Check;
                return (
                  <div
                    key={step.label}
                    className="flex shrink-0 items-center sm:flex-1 sm:shrink last:sm:flex-none"
                  >
                    <div className="flex w-20 shrink-0 flex-col items-center gap-2 text-center">
                      <div
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
                          step.status === "done" &&
                            "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary),transparent_80%)]",
                          step.status === "current" &&
                            "border-primary/60 bg-primary/10 text-primary",
                          step.status === "upcoming" &&
                            "border-white/10 bg-white/[0.03] text-muted-foreground",
                        )}
                      >
                        <Icon className="size-5" />
                      </div>
                      <span
                        className={cn(
                          "text-[11px] leading-tight font-medium text-balance sm:text-sm",
                          step.status === "upcoming"
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {i < tracking.steps.length - 1 && (
                      <div
                        className={cn(
                          "mx-1.5 h-px w-6 shrink-0 sm:mx-3 sm:w-auto sm:flex-1",
                          step.status === "done" ? "bg-primary" : "bg-white/10",
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-white/10 p-6 sm:grid-cols-3 sm:p-8">
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <Calendar className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <span className="block text-xs text-muted-foreground">Demande reçue le</span>
                <span className="block text-sm font-medium text-foreground">
                  {formatDate(tracking.submitted_at)}
                </span>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <span className="block text-xs text-muted-foreground">Contact</span>
                <span className="block truncate text-sm font-medium text-foreground">
                  {tracking.contact_email}
                </span>
              </div>
            </div>
            {tracking.contact_phone && (
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <Phone className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <span className="block text-xs text-muted-foreground">Téléphone</span>
                  <span className="block truncate text-sm font-medium text-foreground">
                    {tracking.contact_phone}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-6 sm:p-8">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTracking(null);
                setError(null);
              }}
              className="h-11 rounded-lg border-white/15 bg-transparent px-5 text-sm font-semibold text-foreground hover:bg-white/5"
            >
              Consulter une autre demande
            </Button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
