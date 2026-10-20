"use client";

import type { ServiceProposal } from "@/lib/api/types";
import {
  Banner,
  ContactBlock,
  Page,
  Paragraphs,
} from "@/components/admin/marketing/document-print-primitives";

export const PROPOSAL_PAGE_COUNT = 3;

export function ServiceProposalDocumentPages({
  proposal,
  accentColor = "#123f91",
  onlyPage,
}: {
  proposal: ServiceProposal;
  accentColor?: string;
  onlyPage?: number;
}) {
  const showPage1 = onlyPage === undefined || onlyPage === 0;
  const showPage2 = onlyPage === undefined || onlyPage === 1;
  const showPage3 = onlyPage === undefined || onlyPage === 2;

  const validUntilText = proposal.valid_until
    ? new Date(proposal.valid_until).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "30 jours";

  const issueDateText = proposal.created_at
    ? new Date(proposal.created_at).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : new Date().toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  return (
    <>
      {/* PAGE 1 : COUVERTURE & PRÉSENTATION */}
      {showPage1 && (
        <Page first>
          <Banner accentColor={accentColor} />

          <div className="flex flex-1 flex-col justify-between px-10 py-10">
            <div>
              <div className="mb-8 flex items-start justify-between">
                <div>
                  <span
                    className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    Offre de services
                  </span>
                  <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-neutral-900 leading-tight">
                    {proposal.title}
                  </h1>
                  {proposal.subject && (
                    <p className="mt-2 text-sm text-neutral-600 font-medium">
                      Objet : {proposal.subject}
                    </p>
                  )}
                </div>

                <div className="text-right text-xs text-neutral-500">
                  <p className="font-mono font-bold text-neutral-900 text-sm">
                    {proposal.proposal_number}
                  </p>
                  <p className="mt-1">Émis le : {issueDateText}</p>
                  <p>Validité : jusqu&apos;au {validUntilText}</p>
                </div>
              </div>

              {/* Bloc Destinataire & Émetteur */}
              <div className="grid grid-cols-2 gap-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Client / Partenaire
                  </p>
                  <p className="mt-1 text-base font-bold text-neutral-900">
                    {proposal.client_name}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Projet de transformation digitale & développement
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Prestataire
                  </p>
                  <p className="mt-1 text-base font-bold text-neutral-900">
                    SOKEN&apos;S DIGITAL
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    Agence d&apos;ingénierie logicielle & solutions cloud
                  </p>
                </div>
              </div>

              {/* Message d'introduction */}
              {proposal.intro_message && (
                <div className="mt-8">
                  <h2
                    className="text-sm font-bold uppercase tracking-wide"
                    style={{ color: accentColor }}
                  >
                    Introduction & Vision
                  </h2>
                  <div className="mt-2 text-xs leading-relaxed text-neutral-700">
                    <Paragraphs text={proposal.intro_message} className="mb-2" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 pt-6">
              <ContactBlock
                address="Abidjan, Côte d'Ivoire&#10;Immeuble Soken's Digital"
                phone="+225 07 00 00 00 00"
                email="contact@sokensdigital.com"
              />
            </div>
          </div>
        </Page>
      )}

      {/* PAGE 2 : CONTEXTE, OBJECTIFS & MÉTHODOLOGIE */}
      {showPage2 && (
        <Page>
          <Banner accentColor={accentColor} />

          <div className="flex flex-1 flex-col justify-between px-10 py-10">
            <div className="space-y-8">
              <div>
                <p className="font-mono text-xs font-bold text-neutral-400">
                  {proposal.proposal_number} — PAGE 2
                </p>
                <h2
                  className="mt-1 text-xl font-bold text-neutral-900"
                  style={{ color: accentColor }}
                >
                  Contexte & Objectifs du Projet
                </h2>
              </div>

              {proposal.context_objectives ? (
                <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm text-xs leading-relaxed text-neutral-700">
                  <Paragraphs text={proposal.context_objectives} />
                </div>
              ) : (
                <p className="text-xs text-neutral-400 italic">
                  Aucun contexte spécifié.
                </p>
              )}

              <div>
                <h2
                  className="text-lg font-bold text-neutral-900 mb-2"
                  style={{ color: accentColor }}
                >
                  Approche Méthodologique & Organisation
                </h2>
                {proposal.methodology ? (
                  <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm text-xs leading-relaxed text-neutral-700">
                    <Paragraphs text={proposal.methodology} />
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 italic">
                    Méthodologie standard Agile Scrum appliquée à chaque jalon.
                  </p>
                )}
              </div>

              {proposal.deliverables_summary && (
                <div>
                  <h3 className="text-sm font-bold text-neutral-800 mb-2">
                    Synthèse des Livrables Clés
                  </h3>
                  <div className="rounded-xl border border-neutral-100 bg-neutral-100/60 p-4 text-xs text-neutral-700">
                    <Paragraphs text={proposal.deliverables_summary} />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-neutral-200 pt-4 text-center text-[0.65rem] text-neutral-400">
              Soken&apos;s Digital — Proposition commerciale & technique confidentielle
            </div>
          </div>
        </Page>
      )}

      {/* PAGE 3 : MODULES DE PRESTATION, TARIFICATION & ENGAGEMENTS */}
      {showPage3 && (
        <Page>
          <Banner accentColor={accentColor} />

          <div className="flex flex-1 flex-col justify-between px-10 py-10">
            <div>
              <div className="mb-6 flex items-baseline justify-between border-b border-neutral-200 pb-3">
                <h2 className="text-xl font-bold text-neutral-900" style={{ color: accentColor }}>
                  Périmètre des Prestations & Modalités
                </h2>
                <span className="font-mono text-xs text-neutral-400">
                  {proposal.proposal_number} — PAGE 3
                </span>
              </div>

              {/* Tableau des modules et prestations */}
              <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead
                    className="text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Module / Phase</th>
                      <th className="px-4 py-2.5 font-semibold">Livrables attendus</th>
                      <th className="px-4 py-2.5 font-semibold text-center">Durée</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Tarif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {proposal.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3 font-semibold text-neutral-900 align-top max-w-[180px]">
                          {item.title}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 align-top whitespace-pre-wrap leading-relaxed">
                          {item.deliverables}
                        </td>
                        <td className="px-4 py-3 text-center text-neutral-500 align-top whitespace-nowrap">
                          {item.duration || "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-neutral-900 align-top whitespace-nowrap">
                          {item.price || "Inclus"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Conditions financières & Générales */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    Modalités de Règlement
                  </h4>
                  <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
                    {proposal.pricing_notes ||
                      "40% à la commande, 40% à la livraison intermédiaire, 20% à la recette définitive."}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-200 bg-white p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                    Validité & Garanties
                  </h4>
                  <p className="mt-1.5 text-xs text-neutral-600 leading-relaxed">
                    {proposal.terms_conditions ||
                      "Offre valable 30 jours. Garantie de conformité et support inclus pendant 3 mois."}
                  </p>
                </div>
              </div>

              {/* Bloc de validation & signature */}
              <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wide">
                  Bon pour accord & Acceptation de l&apos;offre
                </p>
                <div className="mt-4 grid grid-cols-2 gap-8 text-xs text-neutral-500">
                  <div>
                    <p className="font-semibold text-neutral-700">Pour SOKEN&apos;S DIGITAL</p>
                    <p className="mt-1 text-[0.7rem]">Date et signature autorisée</p>
                    <div className="mt-8 h-12 border-b border-dashed border-neutral-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-neutral-700">
                      Pour le Client : {proposal.client_name}
                    </p>
                    <p className="mt-1 text-[0.7rem]">Nom, fonction, date et signature précédée de &quot;Bon pour accord&quot;</p>
                    <div className="mt-8 h-12 border-b border-dashed border-neutral-300" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-4 text-center text-[0.65rem] text-neutral-400">
              SOKEN&apos;S DIGITAL — SARL au capital de 10 000 000 FCFA — Tous droits réservés
            </div>
          </div>
        </Page>
      )}
    </>
  );
}
