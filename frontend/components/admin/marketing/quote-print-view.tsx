"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getQuote, getQuoteSettings } from "@/lib/api/marketing";
import type { Quote, QuoteSettings } from "@/lib/api/types";

const BRAND_BLUE = "#123f91";
const PAGE_BG = "#f2f3f5";

function formatFCFA(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value;
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} FCFA`;
}

function Paragraphs({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, i) => (
        <p key={i} className={className}>
          {block.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

const printColorAdjust = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as CSSProperties;

function Banner() {
  return (
    <div
      className="flex items-center justify-between px-10 py-6"
      style={{ background: BRAND_BLUE, ...printColorAdjust }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo-sokens-digital-white.png" alt="Soken's Digital" className="h-10 w-auto" />
    </div>
  );
}

function Page({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div
      className="mx-auto flex flex-col print:m-0"
      style={{
        width: "210mm",
        minHeight: "297mm",
        background: PAGE_BG,
        breakAfter: "page",
        marginTop: first ? 0 : "8mm",
        ...printColorAdjust,
      }}
    >
      {children}
    </div>
  );
}

function ContactBlock({ settings }: { settings: QuoteSettings }) {
  return (
    <div className="text-sm text-neutral-700">
      <p className="text-base font-bold text-neutral-900">SOKEN&apos;S DIGITAL</p>
      {settings.company_address.split("\n").map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {settings.company_phone && <p>Tél : {settings.company_phone}</p>}
      {settings.company_email && <p>Mail : {settings.company_email}</p>}
    </div>
  );
}

export function QuotePrintView({ id }: { id: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [settings, setSettings] = useState<QuoteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getQuote(id), getQuoteSettings()])
      .then(([q, s]) => {
        setQuote(q);
        setSettings(s);
      })
      .catch(() => setError("Impossible de charger ce devis."));
  }, [id]);

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!quote || !settings) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const totalLines = quote.lines.reduce((sum, l) => sum + Number(l.total_line), 0);
  const total = totalLines - Number(quote.discount_amount);
  const terms = quote.payment_terms.length > 0 ? quote.payment_terms : settings.default_payment_terms;
  const clientLabel = quote.client_name || "Client";

  return (
    <div style={{ background: "#dfe1e6" }}>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3 print:hidden">
        <p className="text-sm text-neutral-500">
          Aperçu du devis <span className="font-medium text-neutral-900">{quote.quote_number}</span>
        </p>
        <Button onClick={() => window.print()} className="gap-1.5 rounded-full px-4">
          <Printer className="size-4" /> Imprimer / Télécharger en PDF
        </Button>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
        }
      `}</style>

      <div className="py-8 print:py-0">
        {/* Page 1 — cover letter */}
        <Page first>
          <Banner />
          <div className="flex-1 px-10 py-8">
            <ContactBlock settings={settings} />

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
        </Page>

        {/* Page 2 — devis table */}
        <Page>
          <div className="relative">
            <Banner />
            <div
              className="absolute top-4 right-10 w-72 rounded-lg bg-white px-5 py-4 text-sm shadow-sm"
              style={printColorAdjust}
            >
              <p className="text-base font-bold" style={{ color: BRAND_BLUE }}>
                DEVIS N° {quote.quote_number}
              </p>
              <p className="mt-1 text-neutral-600">
                Date : {new Date(quote.issue_date).toLocaleDateString("fr-FR")}
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
            <ContactBlock settings={settings} />

            {quote.description && (
              <div className="mt-8">
                <p className="text-lg font-bold" style={{ color: BRAND_BLUE }}>
                  DESCRIPTION :
                </p>
                <Paragraphs text={quote.description} className="mt-2 text-sm leading-relaxed text-neutral-800" />
              </div>
            )}

            <table className="mt-6 w-full border-collapse overflow-hidden rounded-lg text-sm">
              <thead>
                <tr style={{ background: BRAND_BLUE, ...printColorAdjust }}>
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
                      {line.amount_label || formatFCFA(line.total_line)}
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
                style={{ background: BRAND_BLUE, ...printColorAdjust }}
              >
                <p className="text-lg font-bold text-white">Total : {formatFCFA(total)}</p>
              </div>
            </div>
          </div>
        </Page>

        {/* Page 3 — conditions & signatures */}
        <Page>
          <Banner />
          <div className="flex-1 px-10 py-8">
            <p className="text-lg font-bold" style={{ color: BRAND_BLUE }}>
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

            <p className="mt-10 text-lg font-bold" style={{ color: BRAND_BLUE }}>
              MOYENS DE PAIEMENT :
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-800">
              {settings.payment_methods.map((method, i) => (
                <li key={i}>{method.label}</li>
              ))}
            </ul>

            <p className="mt-10 text-lg font-bold" style={{ color: BRAND_BLUE }}>
              ACCEPTÉ PAR :
            </p>
            <div className="mt-4 grid grid-cols-2 gap-8">
              {[clientLabel, "SOKEN'S DIGITAL"].map((label) => (
                <div key={label}>
                  <p className="text-sm font-semibold text-neutral-900">{label}</p>
                  <div className="mt-2 flex h-24 items-center justify-center rounded-lg bg-white text-center text-xs text-neutral-400 italic">
                    Signature suivi de la mention
                    <br />
                    lu et approuvé
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Page>
      </div>
    </div>
  );
}
