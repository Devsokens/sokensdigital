"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  createSpecification,
  updateSpecification,
  getQuoteSettings,
  type SpecificationInput,
  type SpecificationLineInput,
} from "@/lib/api/marketing";
import type { Specification, SpecType } from "@/lib/api/types";
import { SpecificationDocumentPages, SPEC_PAGE_COUNT, type SpecificationDocumentData } from "@/components/admin/marketing/specification-document-pages";
import { DocumentPreviewCards } from "@/components/admin/marketing/document-preview-cards";
import { DOCUMENT_COLOR_SWATCHES } from "@/components/admin/marketing/document-print-primitives";
import { cn } from "@/lib/utils";

const EMPTY_LINE: SpecificationLineInput = { interface_name: "", objective: "" };
const STEPS = ["Informations", "Description", "Interfaces"];

function linesFromSpec(spec?: Specification): SpecificationLineInput[] {
  if (!spec || spec.lines.length === 0) return [{ ...EMPTY_LINE }];
  return spec.lines.map((l) => ({ interface_name: l.interface_name, objective: l.objective }));
}

export function SpecificationEditor({
  spec,
  basePath = "/admin/marketing/cahier-des-charges",
}: {
  spec?: Specification;
  basePath?: string;
}) {
  const router = useRouter();
  const [specType, setSpecType] = useState<SpecType>(spec?.spec_type ?? "FONCTIONNEL");
  const [title, setTitle] = useState(spec?.title ?? "");
  const [clientName, setClientName] = useState(spec?.client_name ?? "");
  const [introMessage, setIntroMessage] = useState(spec?.intro_message ?? "");
  const [description, setDescription] = useState(spec?.description ?? "");
  const [documentColor, setDocumentColor] = useState(spec?.document_color ?? DOCUMENT_COLOR_SWATCHES[0]);
  const [lines, setLines] = useState<SpecificationLineInput[]>(linesFromSpec(spec));
  const [settings, setSettings] = useState<{ company_address: string; company_phone: string; company_email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    getQuoteSettings().then(setSettings).catch(() => {});
  }, []);

  function updateLine(index: number, patch: Partial<SpecificationLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: SpecificationInput = {
      spec_type: specType,
      title,
      client_name: clientName,
      intro_message: introMessage,
      description,
      document_color: documentColor,
      lines: lines.filter((l) => l.interface_name.trim()),
    };

    if (!title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    if (payload.lines.length === 0) {
      setError("Ajoute au moins une ligne (interface + objectif).");
      return;
    }

    setSaving(true);
    try {
      const saved = spec ? await updateSpecification(spec.id, payload) : await createSpecification(payload);
      router.push(`${basePath}?saved=${saved.id}`);
    } catch {
      setError(spec ? "Impossible de modifier ce cahier des charges." : "Impossible de créer le cahier des charges.");
    } finally {
      setSaving(false);
    }
  }

  const draftDocument: SpecificationDocumentData = {
    spec_number: spec?.spec_number ?? "BROUILLON",
    spec_type: specType,
    title,
    client_name: clientName,
    intro_message: introMessage,
    description,
    lines: lines.map((l, i) => ({ id: String(i), interface_name: l.interface_name, objective: l.objective })),
  };

  return (
    <div>
      <Link
        href={basePath}
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="size-3.5" /> Cahier des charges
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
        {spec ? `Modifier ${spec.spec_number}` : "Nouveau cahier des charges"}
      </h1>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    step === i ? "bg-primary text-primary-foreground" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  )}
                >
                  <span className="flex size-4 items-center justify-center rounded-full bg-white/25 text-[0.65rem]">{i + 1}</span>
                  {label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="size-3.5 text-neutral-300" />}
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Type</span>
                  <select value={specType} onChange={(e) => setSpecType(e.target.value as SpecType)} className={inputClass}>
                    <option value="FONCTIONNEL">Fonctionnel</option>
                    <option value="TECHNIQUE">Technique</option>
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Projet / Client</span>
                  <input value={clientName} onChange={(e) => setClientName(e.target.value)} className={inputClass} />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Titre</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
              </label>

              <label className="block">
                <span className={labelClass}>Message d&apos;introduction (page de garde)</span>
                <textarea value={introMessage} onChange={(e) => setIntroMessage(e.target.value)} rows={4} className={inputClass} />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <label className="block">
                <span className={labelClass}>Description</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={8} className={inputClass} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className={labelClass}>Interfaces et objectifs</span>
                  <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Plus className="size-3.5" /> Ajouter une ligne
                  </button>
                </div>
                <div className="space-y-3">
                  {lines.map((line, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-2.5">
                      <input
                        value={line.interface_name}
                        onChange={(e) => updateLine(i, { interface_name: e.target.value })}
                        placeholder="Interface (ex. Page d'accueil)"
                        className={cn(inputClass, "min-w-[180px] flex-1")}
                      />
                      <input
                        value={line.objective}
                        onChange={(e) => updateLine(i, { objective: e.target.value })}
                        placeholder="Objectif"
                        className={cn(inputClass, "min-w-[220px] flex-[2]")}
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        disabled={lines.length === 1}
                        aria-label="Retirer la ligne"
                        className="shrink-0 text-neutral-400 hover:text-destructive disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button type="button" variant="outline" onClick={() => router.push(basePath)} className="rounded-full px-4">
              Annuler
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} className="rounded-full px-4">
                  Précédent
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={() => setStep((s) => s + 1)} className="rounded-full px-5">
                  Suivant
                </Button>
              ) : (
                <Button type="submit" disabled={saving} className="rounded-full px-5">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : spec ? "Enregistrer" : "Créer"}
                </Button>
              )}
            </div>
          </div>
        </form>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <p className={labelClass}>Aperçu</p>
          {settings ? (
            <>
              <DocumentPreviewCards
                pageCount={SPEC_PAGE_COUNT}
                renderPage={(page) => (
                  <SpecificationDocumentPages spec={draftDocument} settings={settings} accentColor={documentColor} onlyPage={page} />
                )}
              />
              <div className="mt-3">
                <span className={labelClass}>Couleur du document</span>
                <div className="flex flex-wrap gap-2">
                  {DOCUMENT_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      onClick={() => setDocumentColor(swatch)}
                      aria-label={swatch}
                      className="flex size-8 items-center justify-center rounded-lg ring-offset-2 transition-shadow"
                      style={{
                        backgroundColor: swatch,
                        boxShadow: documentColor === swatch ? "0 0 0 2px white, 0 0 0 4px #171717" : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-40 w-72 items-center justify-center rounded-xl bg-neutral-100">
              <Loader2 className="size-5 animate-spin text-neutral-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
