"use client";

import type { EmploymentContractDocument } from "@/lib/api/types";
import {
  Banner,
  ContactBlock,
  Page,
  Paragraphs,
} from "@/components/admin/marketing/document-print-primitives";

export const CONTRACT_PAGE_COUNT = 3;

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CDI: "Contrat à Durée Indéterminée (C.D.I)",
  CDD: "Contrat à Durée Déterminée (C.D.D)",
  STAGE: "Convention de Stage Professionnel",
  PRESTATION_FREELANCE: "Contrat de Prestation de Services Freelance",
};

export function EmploymentContractDocumentPages({
  contract,
  accentColor = "#0f766e",
  onlyPage,
}: {
  contract: EmploymentContractDocument;
  accentColor?: string;
  onlyPage?: number;
}) {
  const showPage1 = onlyPage === undefined || onlyPage === 0;
  const showPage2 = onlyPage === undefined || onlyPage === 1;
  const showPage3 = onlyPage === undefined || onlyPage === 2;

  const typeLabel = CONTRACT_TYPE_LABELS[contract.contract_type] || contract.contract_type;

  const startDateText = contract.start_date
    ? new Date(contract.start_date).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Date à convenir";

  const endDateText = contract.end_date
    ? new Date(contract.end_date).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      {/* PAGE 1 : IDENTIFICATION DES PARTIES & CADRE D'ENGAGEMENT */}
      {showPage1 && (
        <Page first>
          <Banner accentColor={accentColor} />

          <div className="flex flex-1 flex-col justify-between px-10 py-10">
            <div>
              <div className="mb-8 flex items-start justify-between border-b border-neutral-200 pb-4">
                <div>
                  <span
                    className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Ressources Humaines & Juridique
                  </span>
                  <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-neutral-900 uppercase">
                    Contrat de Travail
                  </h1>
                  <p className="mt-1 text-sm font-semibold text-neutral-600">
                    {typeLabel}
                  </p>
                </div>

                <div className="text-right text-xs text-neutral-500 font-mono">
                  <p className="font-bold text-neutral-900 text-sm">{contract.contract_number}</p>
                  <p className="mt-1">Date d&apos;effet : {startDateText}</p>
                  {endDateText && <p>Terme : {endDateText}</p>}
                </div>
              </div>

              {/* Bloc Les Parties Contractantes */}
              <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <h3
                  className="text-xs font-bold uppercase tracking-wider mb-4"
                  style={{ color: accentColor }}
                >
                  Entre les soussignés
                </h3>

                <div className="space-y-4 text-xs text-neutral-700">
                  <div>
                    <p className="font-bold text-sm text-neutral-900">
                      1. La Société SOKEN&apos;S DIGITAL SARL
                    </p>
                    <p className="text-neutral-600">
                      Société de services numériques au capital de 10 000 000 FCFA, dont le siège social est situé à Abidjan, Côte d&apos;Ivoire, immatriculée au Registre du Commerce et du Crédit Mobilier, représentée par sa Direction Générale.
                    </p>
                    <p className="mt-1 font-semibold text-neutral-800">
                      Ci-après dénommée &quot;L&apos;Employeur&quot; d&apos;une part,
                    </p>
                  </div>

                  <div className="border-t border-neutral-100 pt-3">
                    <p className="font-bold text-sm text-neutral-900">
                      2. {contract.employee_name}
                    </p>
                    {contract.employee_address && (
                      <p className="text-neutral-600">Demeurant à : {contract.employee_address}</p>
                    )}
                    <div className="mt-1 flex items-center gap-4 text-neutral-500">
                      {contract.employee_email && <span>Email : {contract.employee_email}</span>}
                      {contract.employee_phone && <span>Tél : {contract.employee_phone}</span>}
                    </div>
                    <p className="mt-1 font-semibold text-neutral-800">
                      Ci-après dénommé(e) &quot;Le Salarié&quot; d&apos;autre part.
                    </p>
                  </div>
                </div>
              </div>

              {/* Cadre de l'engagement */}
              <div className="rounded-xl border border-neutral-100 bg-neutral-100/50 p-4 text-xs text-neutral-700 space-y-2">
                <p className="font-bold text-neutral-900">
                  Poste & Affectation : {contract.position}
                  {contract.department ? ` (Département ${contract.department})` : ""}
                </p>
                <p>
                  Période d&apos;essai convenue : <span className="font-semibold">{contract.trial_period || "Non applicable"}</span>
                </p>
                <p>
                  Date de prise de fonction : <span className="font-semibold">{startDateText}</span>
                </p>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-6">
              <ContactBlock
                address="Abidjan, Côte d'Ivoire&#10;Direction des Ressources Humaines"
                phone="+225 07 00 00 00 00"
                email="rh@sokensdigital.com"
              />
            </div>
          </div>
        </Page>
      )}

      {/* PAGE 2 : CONDITIONS DE TRAVAIL, RÉMUNÉRATION & ARTICLES */}
      {showPage2 && (
        <Page>
          <Banner accentColor={accentColor} />

          <div className="flex flex-1 flex-col justify-between px-10 py-10">
            <div className="space-y-6">
              <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2">
                <h2 className="text-lg font-bold text-neutral-900" style={{ color: accentColor }}>
                  Conditions d&apos;Exercice & Rémunération
                </h2>
                <span className="font-mono text-xs text-neutral-400">
                  {contract.contract_number} — PAGE 2
                </span>
              </div>

              {/* Rémunération & Avantages */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <span className="text-[0.7rem] uppercase font-bold text-neutral-400">
                    Rémunération Mensuelle Brute
                  </span>
                  <p className="mt-1 text-base font-bold text-neutral-900 font-mono">
                    {contract.monthly_salary}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-neutral-500">
                    Versée en fin de mois civil par virement bancaire.
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <span className="text-[0.7rem] uppercase font-bold text-neutral-400">
                    Temps & Lieu de Travail
                  </span>
                  <p className="mt-1 text-xs font-semibold text-neutral-900">
                    {contract.working_hours || "40 heures par semaine"}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-neutral-500">
                    {contract.workplace || "Siège social Soken's Digital"}
                  </p>
                </div>
              </div>

              {contract.benefits && (
                <div className="rounded-xl border border-neutral-200 bg-white p-4 text-xs">
                  <span className="font-bold text-neutral-800">Avantages & Équipements accordés :</span>
                  <p className="mt-1 text-neutral-600 leading-relaxed">{contract.benefits}</p>
                </div>
              )}

              {/* Clauses (première moitié) */}
              <div className="space-y-4">
                {contract.clauses.slice(0, 3).map((clause, idx) => (
                  <div key={idx} className="rounded-xl border border-neutral-200 bg-white p-4 text-xs">
                    <h4 className="font-bold text-neutral-900 mb-1" style={{ color: accentColor }}>
                      {clause.title}
                    </h4>
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {clause.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 text-center text-[0.65rem] text-neutral-400">
              Soken&apos;s Digital — Document juridique et contractuel strictement confidentiel
            </div>
          </div>
        </Page>
      )}

      {/* PAGE 3 : CLAUSES COMPLÉMENTAIRES & SIGNATURES */}
      {showPage3 && (
        <Page>
          <Banner accentColor={accentColor} />

          <div className="flex flex-1 flex-col justify-between px-10 py-10">
            <div>
              <div className="mb-6 flex items-baseline justify-between border-b border-neutral-200 pb-3">
                <h2 className="text-xl font-bold text-neutral-900" style={{ color: accentColor }}>
                  Clauses Spécifiques & Formalisation
                </h2>
                <span className="font-mono text-xs text-neutral-400">
                  {contract.contract_number} — PAGE 3
                </span>
              </div>

              {/* Clauses restantes */}
              <div className="space-y-4">
                {contract.clauses.slice(3).map((clause, idx) => (
                  <div key={idx} className="rounded-xl border border-neutral-200 bg-white p-4 text-xs">
                    <h4 className="font-bold text-neutral-900 mb-1" style={{ color: accentColor }}>
                      {clause.title}
                    </h4>
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap">
                      {clause.content}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bloc final de signature */}
              <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                  Fait à Abidjan, en deux (2) exemplaires originaux de bonne foi
                </p>
                <div className="mt-4 grid grid-cols-2 gap-8 text-xs text-neutral-500">
                  <div>
                    <p className="font-semibold text-neutral-800">Pour SOKEN&apos;S DIGITAL SARL</p>
                    <p className="mt-1 text-[0.7rem]">La Direction Générale (signature & cachet)</p>
                    <div className="mt-10 h-14 border-b border-dashed border-neutral-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-800">
                      Le Collaborateur / La Collaboratrice
                    </p>
                    <p className="mt-1 text-[0.7rem]">Signature précédée de la mention manuscrite &quot;Lu et approuvé&quot;</p>
                    <div className="mt-10 h-14 border-b border-dashed border-neutral-300" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 text-center text-[0.65rem] text-neutral-400">
              SOKEN&apos;S DIGITAL — Direction des Ressources Humaines — Document légal
            </div>
          </div>
        </Page>
      )}
    </>
  );
}
