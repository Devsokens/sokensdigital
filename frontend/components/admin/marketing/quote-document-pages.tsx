"use client";

import { Page, Banner, ContactBlock, Paragraphs, printColorAdjust, formatFCFA } from "@/components/admin/marketing/document-print-primitives";
import type { QuotePaymentTerm } from "@/lib/api/types";

/** Only the fields the document shell actually renders — deliberately
 * looser than the full `Quote` type so the live editor's in-memory draft
 * (no id/tracking_token/etc. yet) can feed this directly, same as a
 * fetched, saved quote. */
const pct = (rate: number) => String(Math.round(rate * 1000) / 10).replace(".", ",");

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
  amount_basis?: "HT" | "TTC";
  vat_rate?: string;
  css_rate?: string;
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
  // Taux du devis (figés à sa création), sinon ceux des paramètres.
  const vatRate = Number((quote as { vat_rate?: string }).vat_rate ?? settings.vat_rate ?? 0.18);
  const cssRate = Number((quote as { css_rate?: string }).css_rate ?? settings.css_rate ?? 0.01);
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
        <Banner accentColor={accentColor} tall />
        {/* Page 1 (lettre), d'après le modèle de devis papier : larges marges,
         * coordonnées en grand, objet détaché, lettre plus petite, justifiée
         * et légèrement en retrait. Même mise en page dans le PDF
         * (backend/marketing/templates/marketing/quote_pdf.html). */}
        <div className="flex-1 px-[72px] pt-11 pb-12">
          <div className="text-base leading-snug text-neutral-800">
            {settings.company_address.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            {settings.company_phone && <p>Tél : {settings.company_phone}</p>}
            {settings.company_email && <p>{settings.company_email}</p>}
          </div>

          {quote.subject && (
            <p className="mt-16 px-3 text-justify text-[15px] leading-relaxed font-bold tracking-wide text-neutral-900 uppercase">
              OBJET : {quote.subject}
            </p>
          )}

          <div className="mt-12 space-y-[15px] px-6 text-justify text-[11.5px] leading-[1.75] text-neutral-800">
            <p>Cher partenaire,</p>
            <Paragraphs text={quote.intro_message} />
          </div>
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
              {settings.amount_basis === "HT" ? (
                <p className="text-lg font-bold text-white">Total HT : {formatFCFA(total)}</p>
              ) : (
                <>
                  <p className="text-xs text-white/80">
                    Total HT : {formatFCFA(total)} · TVA {pct(vatRate)} % : {formatFCFA(total * vatRate)}
                    {cssRate > 0 && <> · CSS {pct(cssRate)} % : {formatFCFA(total * cssRate)}</>}
                  </p>
                  <p className="text-lg font-bold text-white">Total TTC : {formatFCFA(total * (1 + vatRate + cssRate))}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </Page>}

      {/* Page 3 — conditions et signatures, d'après le modèle papier (même
       * mise en page dans backend/marketing/templates/marketing/quote_pdf.html). */}
      {showPage3 && <Page first={restAsFirst}>
        <Banner accentColor={accentColor} tall />
        <div className="flex-1 px-20 pt-[34px] pb-10 text-[11.5px] leading-relaxed text-neutral-800">
          <p className="text-[15px] font-bold" style={{ color: accentColor }}>
            CONDITIONS DE PAIEMENT :
          </p>
          <ul className="mt-3.5 list-disc space-y-[5px] pl-[18px]">
            {terms.map((term, i) => (
              <li key={i}>
                {term.label} :{" "}
                <span className="font-bold">
                  {term.percentage}% soit {formatFCFA((total * term.percentage) / 100)}
                </span>
              </li>
            ))}
          </ul>

          {quote.project_duration && (
            <p className="mt-[22px]">
              Notre équipe s&apos;engage à réaliser la prestation dans une durée de{" "}
              <span className="font-bold">{quote.project_duration}</span> à compter de la validation du devis
              et du versement du premier acompte.
            </p>
          )}

          {settings.footer_note && (
            <p className="mt-[22px]">
              <span className="font-bold">
                <span className="underline">NB</span> :
              </span>{" "}
              <span className="italic">{settings.footer_note}</span>
            </p>
          )}

          <p className="mt-[22px]">En cas d&apos;acceptation, merci de nous renvoyer ce document avec la date et votre signature.</p>

          <p className="mt-[34px] text-[15px] font-bold" style={{ color: accentColor }}>
            MOYENS DE PAIEMENT :
          </p>
          <ul className="mt-3.5 list-disc space-y-[5px] pl-[18px]">
            {settings.payment_methods.map((method, i) => (
              <li key={i}>{method.label}</li>
            ))}
          </ul>

          <p className="mt-[34px] text-[15px] font-bold" style={{ color: accentColor }}>
            ACCEPTÉ PAR :
          </p>
          <div className="mt-[18px] grid grid-cols-2">
            {[
              { who: clientLabel, image: quote.signature_url, alt: "Signature du client" },
              { who: "SOKEN'S DIGITAL", image: settings.company_stamp_url, alt: "Cachet Soken's Digital" },
            ].map((side) => (
              <div key={side.alt} className="pl-16">
                <p className="text-xs font-bold text-neutral-900">{side.who}</p>
                <SignBox image={side.image} alt={side.alt} hint="Signature suivi de la mention lu et approuvé" />
                <SignBox hint="Date" className="mt-[22px]" />
              </div>
            ))}
          </div>
        </div>
      </Page>}
    </>
  );
}

/** Cadre blanc de signature (page 3) : mention en tout petit en haut, image
 * (signature du client, cachet) centrée quand elle existe. */
function SignBox({ image, alt, hint, className = "mt-3" }: { image?: string; alt?: string; hint: string; className?: string }) {
  return (
    <div className={`relative flex h-[66px] w-[200px] items-center justify-center rounded-md bg-white ${className}`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={alt ?? ""} className="max-h-[58px] max-w-[180px] object-contain" style={printColorAdjust} />
      ) : (
        <span className="absolute inset-x-0 top-[3px] text-center text-[7.5px] text-neutral-400 italic">{hint}</span>
      )}
    </div>
  );
}
