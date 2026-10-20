"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2, Plus, Send, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import type {
  EmploymentContractDocument,
  EmploymentContractClause,
  EmploymentContractType,
  UserBrief,
} from "@/lib/api/types";
import {
  saveEmploymentContract,
  sendEmploymentContractByEmail,
} from "@/lib/api/documents-service";
import { listUsers } from "@/lib/api/hr";
import {
  EmploymentContractDocumentPages,
  CONTRACT_PAGE_COUNT,
} from "@/components/admin/rh/employment-contract-document-pages";
import { DocumentPreviewCards } from "@/components/admin/marketing/document-preview-cards";
import { DOCUMENT_COLOR_SWATCHES } from "@/components/admin/marketing/document-print-primitives";
import { SendDocumentModal } from "@/components/admin/marketing/send-document-modal";
import { cn } from "@/lib/utils";

const STEPS = ["Salarié & Poste", "Type & Durée", "Rémunération & Horaires", "Clauses contractuelles"];

const CONTRACT_TYPES: { value: EmploymentContractType; label: string }[] = [
  { value: "CDI", label: "CDI — Contrat à Durée Indéterminée" },
  { value: "CDD", label: "CDD — Contrat à Durée Déterminée" },
  { value: "STAGE", label: "Stage Professionnel" },
  { value: "PRESTATION_FREELANCE", label: "Prestation Freelance" },
];

const EMPTY_CLAUSE: EmploymentContractClause = {
  title: "",
  content: "",
};

export function EmploymentContractEditor({
  contract,
  basePath = "/admin/rh/contrats-travail",
}: {
  contract?: EmploymentContractDocument;
  basePath?: string;
}) {
  const router = useRouter();

  // Utilisateurs pour suggestion
  const [users, setUsers] = useState<UserBrief[]>([]);

  // États du formulaire
  const [employeeName, setEmployeeName] = useState(contract?.employee_name ?? "");
  const [employeeEmail, setEmployeeEmail] = useState(contract?.employee_email ?? "");
  const [employeePhone, setEmployeePhone] = useState(contract?.employee_phone ?? "");
  const [employeeAddress, setEmployeeAddress] = useState(contract?.employee_address ?? "");
  const [contractType, setContractType] = useState<EmploymentContractType>(
    contract?.contract_type ?? "CDI"
  );
  const [position, setPosition] = useState(contract?.position ?? "Développeur Fullstack");
  const [department, setDepartment] = useState(contract?.department ?? "Technique");
  const [startDate, setStartDate] = useState(
    contract?.start_date ?? new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(contract?.end_date ?? "");
  const [trialPeriod, setTrialPeriod] = useState(contract?.trial_period ?? "3 mois renouvelable");
  const [monthlySalary, setMonthlySalary] = useState(
    contract?.monthly_salary ?? "750 000 FCFA"
  );
  const [benefits, setBenefits] = useState(
    contract?.benefits ??
      "Assurance santé groupe, prime de transport, équipement informatique portable et forfait data."
  );
  const [workingHours, setWorkingHours] = useState(
    contract?.working_hours ?? "40 heures / semaine (lundi au vendredi, 8h30 - 17h30)"
  );
  const [workplace, setWorkplace] = useState(
    contract?.workplace ?? "Siège social Soken's Digital (Abidjan) avec option télétravail partiel"
  );
  const [clauses, setClauses] = useState<EmploymentContractClause[]>(
    contract?.clauses && contract.clauses.length > 0
      ? contract.clauses
      : [
          {
            title: "Article 1 : Fonctions et missions",
            content:
              "Le Salarié est engagé pour assurer la conception, le développement technique et le maintien en conditions opérationnelles des plateformes confiées par SOKEN'S DIGITAL.",
          },
          {
            title: "Article 2 : Horaires et organisation",
            content:
              "Les horaires de travail sont établis selon les nécessités de service dans le respect des durées légales maximales de travail.",
          },
          {
            title: "Article 3 : Rémunération",
            content:
              "En rémunération de ses fonctions, le Salarié percevra un traitement mensuel brut régulier, payé par virement bancaire à la fin de chaque mois civil.",
          },
          {
            title: "Article 4 : Confidentialité et secret professionnel",
            content:
              "Le Salarié s'engage à la confidentialité la plus totale concernant les projets, codes sources, données et secrets d'affaires de l'entreprise et de ses clients.",
          },
          {
            title: "Article 5 : Propriété intellectuelle",
            content:
              "L'ensemble des créations logicielles, documentations et inventions produites dans le cadre de ses fonctions sont cédées à titre exclusif à SOKEN'S DIGITAL.",
          },
        ]
  );
  const [documentColor, setDocumentColor] = useState(
    contract?.document_color ?? DOCUMENT_COLOR_SWATCHES[1]
  );

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal d'envoi
  const [sendOpen, setSendOpen] = useState(false);
  const [savedForSend, setSavedForSend] = useState<EmploymentContractDocument | null>(null);

  useEffect(() => {
    listUsers()
      .then((res) => setUsers(res.results || []))
      .catch(() => {});
  }, []);

  function handleSelectUser(userId: string) {
    const u = users.find((item) => item.id === userId);
    if (u) {
      setEmployeeName(`${u.first_name} ${u.last_name}`);
      setEmployeeEmail(u.email);
      if (u.department_name) setDepartment(u.department_name);
    }
  }

  function addClause() {
    setClauses((prev) => [
      ...prev,
      {
        title: `Article ${prev.length + 1} : Nouvelle clause`,
        content: "Dispositions contractuelles spécifiques...",
      },
    ]);
  }

  function updateClause(index: number, patch: Partial<EmploymentContractClause>) {
    setClauses((prev) => prev.map((cl, i) => (i === index ? { ...cl, ...patch } : cl)));
  }

  function removeClause(index: number) {
    if (clauses.length <= 1) return;
    setClauses((prev) => prev.filter((_, i) => i !== index));
  }

  const draftContract: EmploymentContractDocument = {
    id: contract?.id ?? "preview",
    contract_number: contract?.contract_number ?? "CTR-2026-XXXX",
    employee_name: employeeName || "Nom du Salarié",
    employee_email: employeeEmail,
    employee_phone: employeePhone,
    employee_address: employeeAddress,
    contract_type: contractType,
    position: position || "Intitulé du poste",
    department,
    start_date: startDate,
    end_date: endDate,
    trial_period: trialPeriod,
    monthly_salary: monthlySalary,
    benefits,
    working_hours: workingHours,
    workplace,
    clauses,
    document_color: documentColor,
    status: contract?.status ?? "BROUILLON",
    created_at: contract?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  async function handleSave(andSend = false) {
    if (!employeeName.trim()) {
      setError("Veuillez renseigner le nom du salarié.");
      return;
    }
    if (!position.trim()) {
      setError("Veuillez renseigner le poste du salarié.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await saveEmploymentContract({
        ...(contract || {}),
        employee_name: employeeName.trim(),
        employee_email: employeeEmail.trim(),
        employee_phone: employeePhone.trim(),
        employee_address: employeeAddress.trim(),
        contract_type: contractType,
        position: position.trim(),
        department: department.trim(),
        start_date: startDate,
        end_date: endDate || undefined,
        trial_period: trialPeriod.trim(),
        monthly_salary: monthlySalary.trim(),
        benefits: benefits.trim(),
        working_hours: workingHours.trim(),
        workplace: workplace.trim(),
        clauses: clauses.filter((c) => c.title.trim()),
        document_color: documentColor,
      });

      if (andSend) {
        setSavedForSend(saved);
        setSendOpen(true);
      } else {
        router.push(basePath);
      }
    } catch {
      setError("Impossible d'enregistrer ce contrat de travail.");
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
        <ArrowLeft className="size-3.5" /> Contrats de travail
      </Link>

      <h1 className="mb-6 text-2xl font-semibold text-neutral-900">
        {contract ? `Modifier ${contract.contract_number}` : "Nouveau contrat de travail"}
      </h1>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_auto]">
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

          {/* Étape 1 : Salarié & Poste */}
          {step === 0 && (
            <div className="space-y-4">
              {users.length > 0 && (
                <label className="block">
                  <span className={labelClass}>Sélectionner un collaborateur inscrit (optionnel)</span>
                  <select
                    onChange={(e) => handleSelectUser(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">— Choisir parmi les utilisateurs —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name} {u.last_name} ({u.email})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Nom et prénom du salarié</span>
                  <input
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="Ex: Marcelle Kouassi"
                    className={inputClass}
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Adresse e-mail professionnelle ou personnelle</span>
                  <input
                    type="email"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    placeholder="salarie@sokensdigital.com"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Téléphone</span>
                  <input
                    type="tel"
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(e.target.value)}
                    placeholder="+225 07 00 00 00 00"
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Adresse de résidence</span>
                  <input
                    value={employeeAddress}
                    onChange={(e) => setEmployeeAddress(e.target.value)}
                    placeholder="Cocody Angré, Abidjan"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Intitulé du poste</span>
                  <input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Lead Développeur, Chef de projet..."
                    className={inputClass}
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Département d&apos;affectation</span>
                  <input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Technique, Marketing, RH..."
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Étape 2 : Type & Durée */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Type de contrat</span>
                <select
                  value={contractType}
                  onChange={(e) => setContractType(e.target.value as EmploymentContractType)}
                  className={inputClass}
                >
                  {CONTRACT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Date de début d&apos;activité</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Date de fin (pour CDD ou stage)</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Période d&apos;essai convenue</span>
                <input
                  value={trialPeriod}
                  onChange={(e) => setTrialPeriod(e.target.value)}
                  placeholder="3 mois renouvelable une fois conformément à la législation"
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {/* Étape 3 : Rémunération & Horaires */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelClass}>Rémunération mensuelle brute</span>
                  <input
                    value={monthlySalary}
                    onChange={(e) => setMonthlySalary(e.target.value)}
                    placeholder="Ex: 850 000 FCFA"
                    className={inputClass}
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Horaires de travail</span>
                  <input
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    placeholder="40h / semaine (lundi au vendredi)"
                    className={inputClass}
                  />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Lieu d&apos;exécution du contrat</span>
                <input
                  value={workplace}
                  onChange={(e) => setWorkplace(e.target.value)}
                  placeholder="Siège social Soken's Digital (Abidjan) avec 2j télétravail"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Avantages sociaux et matériels</span>
                <textarea
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  rows={3}
                  placeholder="Assurance santé, prime de transport, ordinateur portable..."
                  className={inputClass}
                />
              </label>
            </div>
          )}

          {/* Étape 4 : Clauses contractuelles */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className={labelClass}>Articles & Clauses contractuelles</span>
                  <p className="text-[0.7rem] text-neutral-400">
                    Clauses juridiques régissant l&apos;exécution du contrat.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addClause}
                  className="gap-1 rounded-full text-xs"
                >
                  <Plus className="size-3.5" /> Ajouter une clause
                </Button>
              </div>

              <div className="space-y-3">
                {clauses.map((clause, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <input
                        value={clause.title}
                        onChange={(e) => updateClause(i, { title: e.target.value })}
                        placeholder="Titre de l'article (ex: Article 1 : Missions)"
                        className={cn(inputClass, "font-bold text-xs max-w-sm")}
                      />
                      {clauses.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeClause(i)}
                          className="text-neutral-400 hover:text-destructive p-1 rounded"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>

                    <textarea
                      value={clause.content}
                      onChange={(e) => updateClause(i, { content: e.target.value })}
                      rows={3}
                      placeholder="Texte détaillé des dispositions de la clause..."
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Boutons d'action */}
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
          <p className={labelClass}>Aperçu du contrat</p>
          <DocumentPreviewCards
            pageCount={CONTRACT_PAGE_COUNT}
            renderPage={(page) => (
              <EmploymentContractDocumentPages
                contract={draftContract}
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
          documentTitle={`Contrat de travail : ${savedForSend.employee_name}`}
          documentNumber={savedForSend.contract_number}
          recipientName={savedForSend.employee_name}
          suggestedEmails={savedForSend.employee_email ? [savedForSend.employee_email] : []}
          onSend={async (emails, msg) => {
            await sendEmploymentContractByEmail(savedForSend.id, emails, msg);
            router.push(basePath);
          }}
        />
      )}
    </div>
  );
}
