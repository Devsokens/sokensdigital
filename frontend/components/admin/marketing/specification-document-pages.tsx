"use client";

import { Page, Banner, ContactBlock, Paragraphs, printColorAdjust } from "@/components/admin/marketing/document-print-primitives";

const SPEC_TYPE_LABELS: Record<string, string> = {
  FONCTIONNEL: "Cahier des charges fonctionnel",
  TECHNIQUE: "Cahier des charges technique",
};

/** Only the fields the document shell renders — same relaxed-shape
 * convention as QuoteDocumentData, so the live editor's in-memory draft
 * can feed this directly. */
export interface SpecificationDocumentData {
  spec_number: string;
  spec_type: string;
  title: string;
  client_name: string;
  intro_message: string;
  description: string;
  lines: { id: string; interface_name: string; objective: string }[];
}

export interface SpecificationDocumentSettings {
  company_address: string;
  company_phone: string;
  company_email: string;
}

/** Same visual family as QuoteDocumentPages (cahier des charges §"même
 * présentation que le devis") — cover letter + a two-column Interface /
 * Objectifs table instead of priced prestation lines, no totals/payment/
 * signature section since this is an internal document, not a
 * client-facing commercial one. */
export const SPEC_PAGE_COUNT = 2;

export function SpecificationDocumentPages({
  spec,
  settings,
  accentColor,
  horizontal,
  onlyPage,
}: {
  spec: SpecificationDocumentData;
  settings: SpecificationDocumentSettings;
  accentColor: string;
  horizontal?: boolean;
  /** Renders only this one page (0-1) instead of both. */
  onlyPage?: number;
}) {
  const clientLabel = spec.client_name || "Projet";
  const showPage1 = onlyPage === undefined || onlyPage === 0;
  const showPage2 = onlyPage === undefined || onlyPage === 1;
  const restAsFirst = onlyPage !== undefined ? true : horizontal;

  return (
    <>
      {/* Page 1 — cover letter */}
      {showPage1 && <Page first>
        <Banner accentColor={accentColor} />
        <div className="flex-1 px-10 py-8">
          <ContactBlock address={settings.company_address} phone={settings.company_phone} email={settings.company_email} />

          <div className="mt-10 space-y-4 text-sm leading-relaxed text-neutral-800">
            <Paragraphs text={spec.intro_message} />
          </div>

          <p className="mt-10 text-sm font-bold tracking-wide text-neutral-900 uppercase">
            {SPEC_TYPE_LABELS[spec.spec_type] ?? "Cahier des charges"}
            {spec.title ? ` — ${spec.title}` : ""}
          </p>
        </div>
      </Page>}

      {/* Page 2 — interface / objectif table */}
      {showPage2 && <Page first={restAsFirst}>
        <div className="relative">
          <Banner accentColor={accentColor} />
          <div
            className="absolute top-4 right-10 w-72 rounded-lg bg-white px-5 py-4 text-sm shadow-sm"
            style={printColorAdjust}
          >
            <p className="text-base font-bold" style={{ color: accentColor }}>
              {spec.spec_number}
            </p>
            <p className="mt-1 text-neutral-600">Projet : {clientLabel}</p>
          </div>
        </div>

        <div className="flex-1 px-10 py-8">
          {spec.description && (
            <div className="mb-8">
              <p className="text-lg font-bold" style={{ color: accentColor }}>
                DESCRIPTION :
              </p>
              <Paragraphs text={spec.description} className="mt-2 text-sm leading-relaxed text-neutral-800" />
            </div>
          )}

          <table className="w-full border-collapse overflow-hidden rounded-lg text-sm">
            <thead>
              <tr style={{ background: accentColor, ...printColorAdjust }}>
                <th className="w-1/3 px-4 py-2.5 text-left font-semibold text-white">Interface</th>
                <th className="px-4 py-2.5 text-left font-semibold text-white">Objectifs</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {spec.lines.map((line) => (
                <tr key={line.id} className="border-b border-neutral-200 align-top">
                  <td className="px-4 py-3 font-medium text-neutral-900">{line.interface_name}</td>
                  <td className="px-4 py-3 text-neutral-600">{line.objective}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Page>}
    </>
  );
}
