"use client";

import { Banner, Page, printColorAdjust } from "@/components/admin/marketing/document-print-primitives";
import type { InvoiceEditorContext } from "@/lib/api/finance";
import type { InvoiceLine } from "@/lib/api/types";

/* Facture, d'après le modèle papier de Soken's Digital — même mise en page
 * que le PDF (backend/finance/templates/finance/invoice_pdf.html). Modifier
 * les deux ensemble. */

export interface InvoiceDocumentData {
  invoice_number: string;
  client_name: string;
  issue_date: string;
  lines: InvoiceLine[];
  /** Réduction HT, à part des lignes. */
  discount_amount: number;
  discount_reason: string;
  /** Taux décimal (0.18 = 18 %). */
  vat_rate: number;
  /** Contribution Spéciale de Solidarité, taux décimal (0.01 = 1 %). */
  css_rate?: number;
  amount_paid: number;
  /** Devis d'origine, rappelé dans l'encadré pour la traçabilité. */
  quote_number?: string | null;
}

function amount(value: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(value));
}

function quantity(value: string) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

/** Mêmes calculs que le serveur : HT = lignes − réduction,
 * TTC = HT + TVA + CSS (Contribution Spéciale de Solidarité, 1 % par défaut). */
export function invoiceTotals(lines: InvoiceLine[], discount: number, vatRate: number, paid: number, cssRate = 0.01) {
  const subtotal = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const ht = subtotal - discount;
  const vat = Math.round(ht * vatRate * 100) / 100;
  const css = Math.round(ht * cssRate * 100) / 100;
  const ttc = ht + vat + css;
  return { subtotal, discount, ht, vat, css, ttc, paid, due: Math.max(ttc - paid, 0) };
}

export function InvoiceDocument({
  invoice,
  settings,
  accentColor,
}: {
  invoice: InvoiceDocumentData;
  settings: InvoiceEditorContext["settings"];
  accentColor: string;
}) {
  const cssRate = invoice.css_rate ?? 0.01;
  const totals = invoiceTotals(invoice.lines, invoice.discount_amount, invoice.vat_rate, invoice.amount_paid, cssRate);
  const clientLabel = invoice.client_name || "Client";
  const lines = invoice.lines.filter((l) => l.description || Number(l.unit_price));

  return (
    <Page first>
      <div className="relative">
        <Banner accentColor={accentColor} tall />
        <div className="absolute top-[34px] right-12 w-[272px] rounded-lg bg-white px-5 py-4 text-[11.5px]" style={printColorAdjust}>
          <p className="text-xl font-bold tracking-wide" style={{ color: accentColor }}>FACTURE</p>
          <p className="text-[13px] font-bold whitespace-nowrap" style={{ color: accentColor }}>
            N° {invoice.invoice_number || "—"}
          </p>
          <p className="mt-2">Date : {invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString("fr-FR") : "—"}</p>
          <p className="mt-2">Client : {clientLabel}</p>
          {invoice.quote_number && <p className="mt-1 text-[10px] text-neutral-500">Réf. devis : {invoice.quote_number}</p>}
        </div>
      </div>

      <div className="flex-1 px-14 pt-12 pb-10 text-[11.5px] leading-snug text-neutral-900">
        <div className="pl-6 leading-relaxed text-neutral-800">
          <p className="mb-1 text-sm font-bold text-neutral-900">SOKEN&apos;S DIGITAL</p>
          {settings.company_address.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {settings.company_phone && <p>Tél : {settings.company_phone}</p>}
          {settings.company_email && <p>Mail : {settings.company_email}</p>}
          {(settings.company_rccm || settings.company_nif) && (
            <p className="mt-1.5 text-[10px] tracking-wide text-neutral-500">
              {[settings.company_rccm && `RCCM : ${settings.company_rccm}`, settings.company_nif && `NIF : ${settings.company_nif}`]
                .filter(Boolean)
                .join("  ·  ")}
            </p>
          )}
        </div>

        <table className="mt-9 w-full border-collapse">
          <thead>
            <tr style={{ background: accentColor, ...printColorAdjust }}>
              {["Description", "Qté", "Prix unitaire", "Total"].map((label, i) => (
                <th
                  key={label}
                  className={`border border-neutral-300 px-2.5 py-4 text-center font-normal tracking-wide text-white uppercase ${["w-1/2", "w-[8%]", "w-1/4", ""][i]}`}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="align-top">
                <td className="border border-neutral-400 px-2.5 py-3 whitespace-pre-line">{line.description.trim()}</td>
                <td className="border border-neutral-400 px-2.5 py-3 text-center">{quantity(line.quantity)}</td>
                <td className="border border-neutral-400 px-2.5 py-3 text-center">
                  <span className="font-bold">{amount(Number(line.unit_price) || 0)}</span>
                  {line.note && <span className="mt-0.5 block text-[10px] leading-snug">{line.note}</span>}
                </td>
                <td className="border border-neutral-400 px-2.5 py-3 text-center">
                  {amount((Number(line.quantity) || 0) * (Number(line.unit_price) || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-11 flex items-start justify-between gap-6">
          <div className="pt-11">
            {settings.payment_methods.length > 0 && (
              <>
                <p className="text-[13px] font-bold" style={{ color: accentColor }}>
                  MOYENS DE PAIEMENT :
                </p>
                <ul className="mt-3 list-disc space-y-0.5 pl-4 text-[10.5px]">
                  {settings.payment_methods.map((method, i) => (
                    <li key={i}>{method.label}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <table className="border-collapse text-xs">
            <tbody>
              {totals.discount > 0 && (
                <>
                  <tr className="text-[10.5px]">
                    <td className="px-2.5 py-0.5 text-right tracking-wide text-neutral-500 uppercase">Sous-total</td>
                    <td className="px-2.5 py-0.5 text-right whitespace-nowrap">{amount(totals.subtotal)} FCFA</td>
                  </tr>
                  <tr className="text-[10.5px]">
                    <td className="px-2.5 py-0.5 text-right tracking-wide text-neutral-500 uppercase">
                      Réduction{invoice.discount_reason ? ` (${invoice.discount_reason})` : ""}
                    </td>
                    <td className="px-2.5 py-0.5 text-right whitespace-nowrap text-red-700">− {amount(totals.discount)} FCFA</td>
                  </tr>
                </>
              )}
              {(invoice.vat_rate > 0 || cssRate > 0) && (
                <>
                  <tr className="text-[10.5px]">
                    <td className="px-2.5 py-0.5 text-right tracking-wide text-neutral-500 uppercase">Total HT</td>
                    <td className="px-2.5 py-0.5 text-right whitespace-nowrap">{amount(totals.ht)} FCFA</td>
                  </tr>
                  <tr className="text-[10.5px]">
                    <td className="px-2.5 py-0.5 text-right tracking-wide text-neutral-500 uppercase">
                      TVA {Math.round(invoice.vat_rate * 1000) / 10} %
                    </td>
                    <td className="px-2.5 py-0.5 text-right whitespace-nowrap">{amount(totals.vat)} FCFA</td>
                  </tr>
                  {cssRate > 0 && (
                    <tr className="text-[10.5px]">
                      <td className="px-2.5 py-0.5 text-right tracking-wide text-neutral-500 uppercase">
                        CSS {Math.round(cssRate * 1000) / 10} %
                      </td>
                      <td className="px-2.5 py-0.5 text-right whitespace-nowrap">{amount(totals.css)} FCFA</td>
                    </tr>
                  )}
                </>
              )}
              <tr>
                <td className="px-2.5 py-[7px] text-right tracking-wide uppercase" style={{ color: accentColor }}>Total à payer</td>
                <td className="min-w-[92px] px-2.5 py-[7px] text-right whitespace-nowrap text-white" style={{ background: accentColor, ...printColorAdjust }}>
                  {amount(totals.ttc)} FCFA
                </td>
              </tr>
              <tr>
                <td className="px-2.5 py-[7px] text-right tracking-wide uppercase" style={{ color: accentColor }}>Déjà payé</td>
                <td className="px-2.5 py-[7px] text-right whitespace-nowrap" style={{ borderBottom: `2px solid ${accentColor}` }}>
                  {amount(totals.paid)} FCFA
                </td>
              </tr>
              <tr>
                <td className="px-2.5 py-[7px] text-right tracking-wide uppercase" style={{ color: accentColor }}>Reste à payer</td>
                <td className="px-2.5 py-[7px] text-right whitespace-nowrap">{amount(totals.due)} FCFA</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-14">
          <p className="pl-6 text-[13px] font-bold" style={{ color: accentColor }}>
            ACCEPTÉ PAR :
          </p>
          <div className="mt-5 grid grid-cols-2">
            <Signer who={clientLabel} />
            <Signer who="SOKEN'S DIGITAL" image={settings.company_stamp_url} alt="Cachet Soken's Digital" />
          </div>
        </div>
      </div>
    </Page>
  );
}

function Signer({ who, image, alt }: { who: string; image?: string; alt?: string }) {
  return (
    <div className="flex items-center">
      <p className="w-[42%] pl-9 text-[10.5px] font-bold">{who}</p>
      <div className="relative flex h-[76px] w-[148px] items-center justify-center rounded-md bg-white" style={printColorAdjust}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={alt ?? ""} className="max-h-[66px] max-w-[136px] object-contain" />
        ) : (
          <span className="absolute inset-x-0 top-[5px] text-center text-[6.5px] text-neutral-400 italic">
            Signature suivi de la mention lu et approuvé
          </span>
        )}
      </div>
    </div>
  );
}
