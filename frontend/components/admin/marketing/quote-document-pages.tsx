"use client";

import { Page, Banner, ContactBlock, Paragraphs, printColorAdjust, formatFCFA } from "@/components/admin/marketing/document-print-primitives";
import type { QuotePaymentTerm } from "@/lib/api/types";

/** Only the fields the document shell actually renders — deliberately
 * looser than the full `Quote` type so the live editor's in-memory draft
 * (no id/tracking_token/etc. yet) can feed this directly, same as a
 * fetched, saved quote. */
export interface QuoteDocumentData {
  quote_number: string;
  client_name: string;
  intro_message: string;
  subject: string;
  description: string;
  project_duration: string;
  issue_date: string;
  discount_amount: string;
  payment_terms: QuotePaymentTerm[];
  lines: { id: string; service_title: string; description: string; total_line: string; amount_label: string }[];
  /** Set once the client has accepted via the public signature pad
   * (§4.7) — absent on a still-BROUILLON/ENVOYE quote or the live
   * editor's in-progress draft. */
  signature_url?: string;
}

export interface QuoteDocumentSettings {
  company_address: string;
  company_phone: string;
  company_email: string;
  company_stamp_url: string;
  footer_note: string;
  payment_methods: { label: string }[];
  default_payment_terms: QuotePaymentTerm[];
}

/** The three-page devis document shell — pure presentation, no fetching.
 * Used both by the standalone /imprimer route (fed a real saved Quote)
 * and by the live editor's side preview (fed the in-progress form
 * state), so both always render identically. */
export const QUOTE_PAGE_COUNT = 3;

export function QuoteDocumentPages({
  quote,
  settings,
  accentColor,
  horizontal,
  onlyPage,
}: {
  quote: QuoteDocumentData;
  settings: QuoteDocumentSettings;
  accentColor: string;
  /** Side-by-side preview mode — every page renders as "first" so
   * Page's vertical stacking margin doesn't misalign them when the
   * caller lays them out in a flex row instead of stacked. */
  horizontal?: boolean;
  /** Renders only this one page (0-2) instead of all three — used by
   * the live editor's single-page-at-a-time preview carousel. */
  onlyPage?: number;
}) {
  const totalLines = quote.lines.reduce((sum, l) => sum + Number(l.total_line || 0), 0);
  const total = totalLines - Number(quote.discount_amount || 0);
  const terms = quote.payment_terms.length > 0 ? quote.payment_terms : settings.default_payment_terms;
  const clientLabel = quote.client_name || "Client";

  const showPage1 = onlyPage === undefined || onlyPage === 0;
  const showPage2 = onlyPage === undefined || onlyPage === 1;
  const showPage3 = onlyPage === undefined || onlyPage === 2;
  // Pages 2/3 get "first" (no top stacking margin) when isolated to a
  // single page (no stacking context at all) or laid out side-by-side
  // (horizontal) — the default vertical-stack margin otherwise.
  const restAsFirst = onlyPage !== undefined ? true : horizontal;

  return (
    <>
      {/* Page 1 — cover letter */}
      {showPage1 && <Page first>
        <Banner accentColor={accentColor} />
        <div className="flex-1 px-10 py-8">
          <ContactBlock address={settings.company_address} phone={settings.company_phone} email={settings.company_email} />

          <div className="mt-10 space-y-4 text-sm leading-relaxed text-neutral-800">
            <p>Cher partenaire,</p>
            <Paragraphs text={quote.intro_message} />
          </div>

          {quote.subject && (
            <p className="mt-10 text-sm font-bold tracking-wide text-neutral-900 uppercase">
              OBJET : {quote.subject}
            </p>
          )}
        </div>
      </Page>}

      {/* Page 2 — devis table */}
      {showPage2 && <Page first={restAsFirst}>
        <div className="relative">
          <Banner accentColor={accentColor} />
          <div
            className="absolute top-4 right-10 w-72 rounded-lg bg-white px-5 py-4 text-sm shadow-sm"
            style={printColorAdjust}
          >
            <p className="text-base font-bold" style={{ color: accentColor }}>
              DEVIS N° {quote.quote_number}
            </p>
            <p className="mt-1 text-neutral-600">
              Date : {quote.issue_date ? new Date(quote.issue_date).toLocaleDateString("fr-FR") : "—"}
            </p>
            <p className="text-neutral-600">Client : {clientLabel}</p>
            {quote.project_duration && (
              <p className="text-neutral-600">
                Durée du projet : <span className="font-semibold text-red-600">{quote.project_duration}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex-1 px-10 py-8">
          <ContactBlock address={settings.company_address} phone={settings.company_phone} email={settings.company_email} />

          {quote.description && (
            <div className="mt-8">
              <p className="text-lg font-bold" style={{ color: accentColor }}>
                DESCRIPTION :
              </p>
              <Paragraphs text={quote.description} className="mt-2 text-sm leading-relaxed text-neutral-800" />
            </div>
          )}

          <table className="mt-6 w-full border-collapse overflow-hidden rounded-lg text-sm">
            <thead>
              <tr style={{ background: accentColor, ...printColorAdjust }}>
                <th className="w-1/4 px-4 py-2.5 text-left font-semibold text-white">Prestation</th>
                <th className="px-4 py-2.5 text-left font-semibold text-white">Description</th>
                <th className="w-1/5 px-4 py-2.5 text-right font-semibold text-white">Montant</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {quote.lines.map((line) => (
                <tr key={line.id} className="border-b border-neutral-200 align-top">
                  <td className="px-4 py-3 font-medium text-neutral-900">{line.service_title}</td>
                  <td className="px-4 py-3 text-neutral-600">{line.description}</td>
                  <td className="px-4 py-3 text-right text-neutral-900">
                    {line.amount_label || formatFCFA(line.total_line || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 flex items-end justify-between gap-6">
            {settings.footer_note && (
              <p className="max-w-md text-xs leading-relaxed text-neutral-500 italic">
                <span className="not-italic font-semibold">NB : </span>
                {settings.footer_note}
              </p>
            )}
            <div
              className="shrink-0 rounded-lg px-6 py-3 text-right"
              style={{ background: accentColor, ...printColorAdjust }}
            >
              <p className="text-lg font-bold text-white">Total : {formatFCFA(total)}</p>
            </div>
          </div>
        </div>
      </Page>}

      {/* Page 3 — conditions & signatures */}
      {showPage3 && <Page first={restAsFirst}>
        <Banner accentColor={accentColor} />
        <div className="flex-1 px-10 py-8">
          <p className="text-lg font-bold" style={{ color: accentColor }}>
            CONDITIONS DE PAIEMENT :
          </p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-800">
            {terms.map((term, i) => (
              <li key={i}>
                {term.label} soit <span className="font-semibold">{formatFCFA((total * term.percentage) / 100)}</span>{" "}
                <span className="text-neutral-500">({term.percentage}%)</span>
              </li>
            ))}
          </ul>

          {quote.project_duration && (
            <p className="mt-6 text-sm leading-relaxed text-neutral-800">
              Notre équipe s&apos;engage à réaliser la prestation dans une durée de{" "}
              <span className="font-semibold">{quote.project_duration}</span> à compter de la validation du devis
              et du versement du premier acompte.
            </p>
          )}

          {settings.footer_note && (
            <p className="mt-6 text-xs leading-relaxed text-neutral-600 italic">
              <span className="not-italic font-semibold">NB : </span>
              {settings.footer_note}
            </p>
          )}

          <p className="mt-6 text-sm text-neutral-800">
            En cas d&apos;acceptation, merci de nous renvoyer ce document avec la date et votre signature.
          </p>

          <p className="mt-10 text-lg font-bold" style={{ color: accentColor }}>
            MOYENS DE PAIEMENT :
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-800">
            {settings.payment_methods.map((method, i) => (
              <li key={i}>{method.label}</li>
            ))}
          </ul>

          <p className="mt-10 text-lg font-bold" style={{ color: accentColor }}>
            ACCEPTÉ PAR :
          </p>
          <div className="mt-4 grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-semibold text-neutral-900">{clientLabel}</p>
              <div className="mt-2 flex h-24 items-center justify-center rounded-lg bg-white">
                {quote.signature_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={quote.signature_url} alt="Signature du client" className="max-h-20 max-w-full object-contain" style={printColorAdjust} />
                ) : (
                  <p className="text-center text-xs text-neutral-400 italic">
                    Signature suivi de la mention
                    <br />
                    lu et approuvé
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">SOKEN&apos;S DIGITAL</p>
              <div className="mt-2 flex h-24 items-center justify-center rounded-lg bg-white">
                {settings.company_stamp_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={settings.company_stamp_url} alt="Cachet Soken's Digital" className="max-h-20 max-w-full object-contain" style={printColorAdjust} />
                ) : (
                  <p className="text-center text-xs text-neutral-400 italic">
                    Signature suivi de la mention
                    <br />
                    lu et approuvé
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </Page>}
    </>
  );
}
