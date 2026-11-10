"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import type { ServiceProposal, ServiceProposalItem } from "@/lib/api/types";
import {
  saveServiceProposal,
  sendServiceProposalByEmail,
} from "@/lib/api/documents-service";
import {
  ServiceProposalDocumentPages,
  PROPOSAL_PAGE_COUNT,
} from "@/components/admin/marketing/service-proposal-document-pages";
import { DocumentPreviewCards } from "@/components/admin/marketing/document-preview-cards";
import { DOCUMENT_COLOR_SWATCHES } from "@/components/admin/marketing/document-print-primitives";
import {
  ClientLeadSelector,
  type SelectedClientEntity,
} from "@/components/admin/marketing/client-lead-selector";
import { SendDocumentModal } from "@/components/admin/marketing/send-document-modal";
import { cn } from "@/lib/utils";

const STEPS = ["Général", "Contexte & Approche", "Prestations & Prix", "Modalités"];

const EMPTY_ITEM: ServiceProposalItem = {
  title: "",
  deliverables: "",
  duration: "",
  price: "",
};

export function ServiceProposalEditor({
  proposal,
  basePath = "/admin/marketing/offres-de-service",
}: {
  proposal?: ServiceProposal;
  basePath?: string;
}) {
  const router = useRouter();

  // États du formulaire
  const [clientName, setClientName] = useState(proposal?.client_name ?? "");
  const [selectedEntity, setSelectedEntity] = useState<SelectedClientEntity | null>(null);
  const [title, setTitle] = useState(
    proposal?.title ?? "Accompagnement et développement de solutions digitales"
  );
  const [subject, setSubject] = useState(
    proposal?.subject ?? "Proposition technique et commerciale"
  );
  const [introMessage, setIntroMessage] = useState(
    proposal?.intro_message ??
      "Soken's Digital est honoré de vous présenter son offre de services pour la conception, le développement et le déploiement de vos outils numériques."
  );
  const [contextObjectives, setContextObjectives] = useState(
    proposal?.context_objectives ??
      "Moderniser l'infrastructure existante, améliorer l'expérience utilisateur et automatiser les processus clés."
  );
  const [methodology, setMethodology] = useState(
    proposal?.methodology ??
      "Cycle de développement Agile avec sprints courts de 2 semaines, réunions de cadrage et validation continue des jalons."
  );
  const [deliverablesSummary, setDeliverablesSummary] = useState(
    proposal?.deliverables_summary ??
      "Code source documenté, plateformes web & mobiles opérationnelles, manuels d'utilisation et support technique dédié."
  );
  const [items, setItems] = useState<ServiceProposalItem[]>(
    proposal?.items && proposal.items.length > 0
      ? proposal.items
      : [
          {
            title: "Phase 1 : Cadrage & Conception UI/UX",
            deliverables: "Architecture logicielle, maquettes Figma interactives et spécifications.",
            duration: "2 semaines",
            price: "800 000 FCFA",
          },
          {
            title: "Phase 2 : Développement & Intégration",
            deliverables: "Développement fullstack, API sécurisées et console d'administration.",
            duration: "4 semaines",
            price: "2 200 000 FCFA",
          },
          {
            title: "Phase 3 : Déploiement & Formation",
            deliverables: "Mise en production, configuration cloud et transfert de compétences.",
            duration: "1 semaine",
            price: "500 000 FCFA",
          },
        ]
  );
  const [pricingNotes, setPricingNotes] = useState(
    proposal?.pricing_notes ??
      "Échelonnement : 40% au démarrage, 40% à la livraison intermédiaire, 20% à la recette définitive."
  );
  const [termsConditions, setTermsConditions] = useState(
    proposal?.terms_conditions ??
      "Offre valable 30 jours à compter de la date d'émission. Garantie de conformité et assistance incluses pendant 3 mois."
  );
  const [validUntil, setValidUntil] = useState(proposal?.valid_until ?? "");
  const [documentColor, setDocumentColor] = useState(
    proposal?.document_color ?? DOCUMENT_COLOR_SWATCHES[0]
  );

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal d'envoi
  const [sendOpen, setSendOpen] = useState(false);
  const [savedForSend, setSavedForSend] = useState<ServiceProposal | null>(null);

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function updateItem(index: number, patch: Partial<ServiceProposalItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Objet temporaire pour l'aperçu dynamique
  const draftProposal: ServiceProposal = {
    id: proposal?.id ?? "preview",
    proposal_number: proposal?.proposal_number ?? "PROP-2026-XXXX",
    client_name: clientName || "Nom du Client",
    title: title || "Titre de l'Offre",
    subject,
    intro_message: introMessage,
    context_objectives: contextObjectives,
    methodology,
    deliverables_summary: deliverablesSummary,
    items,
    pricing_notes: pricingNotes,
    terms_conditions: termsConditions,
    valid_until: validUntil,
    document_color: documentColor,
    status: proposal?.status ?? "BROUILLON",
    created_at: proposal?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  async function handleSave(andSend = false) {
    if (!clientName.trim()) {
      setError("Veuillez sélectionner ou saisir un client.");
      return;
    }
    if (!title.trim()) {
      setError("Veuillez renseigner un titre pour l'offre.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await saveServiceProposal({
        ...(proposal || {}),
        client_name: clientName.trim(),
        title: title.trim(),
        subject: subject.trim(),
        intro_message: introMessage.trim(),
        context_objectives: contextObjectives.trim(),
        methodology: methodology.trim(),
        deliverables_summary: deliverablesSummary.trim(),
        items: items.filter((it) => it.title.trim()),
        pricing_notes: pricingNotes.trim(),
        terms_conditions: termsConditions.trim(),
        valid_until: validUntil || undefined,
        document_color: documentColor,
        lead_id: selectedEntity?.type === "lead" ? selectedEntity.id : proposal?.lead_id,
        client_id: selectedEntity?.type === "client" ? selectedEntity.id : proposal?.client_id,
      });

      if (andSend) {
        setSavedForSend(saved);
        setSendOpen(true);
      } else {
        router.push(basePath);
      }
    } catch {
      setError("Impossible d'enregistrer cette offre de services.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link
        href={basePath}
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="size-3.5" /> Offres de service
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
        {proposal ? `Modifier ${proposal.proposal_number}` : "Nouvelle offre de services"}
      </h1>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        {/* Formulaire étape par étape */}
        <div className="space-y-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          {/* Stepper */}
          <div className="flex flex-wrap items-center gap-1.5">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    step === i
                      ? "bg-primary text-primary-foreground"
                      : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                  )}
                >
                  <span className="flex size-4 items-center justify-center rounded-full bg-white/25 text-[0.65rem]">
                    {i + 1}
                  </span>
                  {label}
                </button>
                {i < STEPS.length - 1 && <ChevronRight className="size-3.5 text-neutral-300" />}
              </div>
            ))}
          </div>

          {/* Étape 1 : Général */}
          {step === 0 && (
            <div className="space-y-4">
              <ClientLeadSelector
                value={clientName}
                onChange={setClientName}
                onEntityChange={setSelectedEntity}
              />

              <label className="block">
                <span className={labelClass}>Titre de la proposition</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Refonte du portail e-commerce & intégration ERP"
                  className={inputClass}
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Objet</span>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Proposition d'accompagnement digital"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Validité de l&apos;offre jusqu&apos;au</span>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Message d&apos;introduction (Page de garde)</span>
                <textarea
                  value={introMessage}
                  onChange={(e) => setIntroMessage(e.target.value)}
                  rows={4}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {/* Étape 2 : Contexte & Méthodologie */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Contexte et objectifs du client</span>
                <textarea
                  value={contextObjectives}
                  onChange={(e) => setContextObjectives(e.target.value)}
                  rows={4}
                  placeholder="Présentez les enjeux stratégiques, les besoins exprimés..."
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Approche méthodologique</span>
                <textarea
                  value={methodology}
                  onChange={(e) => setMethodology(e.target.value)}
                  rows={4}
                  placeholder="Ex: Méthodologie Agile Scrum, jalons de validation, sprints..."
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Synthèse des livrables clés</span>
                <textarea
                  value={deliverablesSummary}
                  onChange={(e) => setDeliverablesSummary(e.target.value)}
                  rows={3}
                  placeholder="Code source, applications, documentation..."
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {/* Étape 3 : Prestations & Prix */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={labelClass}>Phases & Modules de prestation</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addItem}
                  className="gap-1 rounded-full text-xs"
                >
                  <Plus className="size-3.5" /> Ajouter un module
                </Button>
              </div>

              <div className="space-y-3">
                {items.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-700">
                        Module #{i + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(i)}
                          className="text-neutral-400 hover:text-destructive p-1 rounded"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className={labelClass}>Intitulé du module</span>
                        <input
                          value={item.title}
                          onChange={(e) => updateItem(i, { title: e.target.value })}
                          placeholder="Ex: Phase 1 : Conception UX/UI"
                          className={inputClass}
                          required
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className={labelClass}>Durée</span>
                          <input
                            value={item.duration || ""}
                            onChange={(e) => updateItem(i, { duration: e.target.value })}
                            placeholder="2 semaines"
                            className={inputClass}
                          />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Tarif</span>
                          <input
                            value={item.price || ""}
                            onChange={(e) => updateItem(i, { price: e.target.value })}
                            placeholder="750 000 FCFA"
                            className={inputClass}
                          />
                        </label>
                      </div>
                    </div>

                    <label className="block">
                      <span className={labelClass}>Livrables attendus pour ce module</span>
                      <textarea
                        value={item.deliverables}
                        onChange={(e) => updateItem(i, { deliverables: e.target.value })}
                        rows={2}
                        placeholder="Maquettes interactives, spécifications techniques, validation..."
                        className={inputClass}
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Étape 4 : Modalités & Clôture */}
          {step === 3 && (
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Modalités de règlement & Facturation</span>
                <textarea
                  value={pricingNotes}
                  onChange={(e) => setPricingNotes(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Validité & Conditions d&apos;intervention</span>
                <textarea
                  value={termsConditions}
                  onChange={(e) => setTermsConditions(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {/* Barre de navigation et boutons d'action */}
          <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(basePath)}
              className="rounded-full px-4 text-xs"
            >
              Annuler
            </Button>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                  className="rounded-full px-4 text-xs"
                >
                  Précédent
                </Button>
              )}

              {step < STEPS.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="rounded-full px-5 text-xs shadow-sm"
                >
                  Suivant
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(false)}
                    variant="outline"
                    className="rounded-full px-4 text-xs"
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Enregistrer"}
                  </Button>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSave(true)}
                    className="gap-1.5 rounded-full px-5 text-xs shadow-sm"
                  >
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Enregistrer & Envoyer
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Colonne de prévisualisation à droite */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <p className={labelClass}>Aperçu du document</p>
          <DocumentPreviewCards
            pageCount={PROPOSAL_PAGE_COUNT}
            renderPage={(page) => (
              <ServiceProposalDocumentPages
                proposal={draftProposal}
                accentColor={documentColor}
                onlyPage={page}
              />
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
                    boxShadow:
                      documentColor === swatch ? "0 0 0 2px white, 0 0 0 4px #171717" : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal d'envoi par e-mail */}
      {savedForSend && (
        <SendDocumentModal
          open={sendOpen}
          onOpenChange={(isOpen) => {
            setSendOpen(isOpen);
            if (!isOpen) router.push(basePath);
          }}
          documentTitle={savedForSend.title}
          documentNumber={savedForSend.proposal_number}
          recipientName={savedForSend.client_name}
          suggestedEmails={selectedEntity?.emails || []}
          onSend={async (emails, msg) => {
            await sendServiceProposalByEmail(savedForSend.id, emails, msg);
            router.push(basePath);
          }}
        />
      )}
    </div>
  );
}
