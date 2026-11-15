"use client";

import { useState } from "react";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { Download, Pencil, Wallet, X } from "lucide-react";
import { DocumentPreviewCards } from "@/components/admin/marketing/document-preview-cards";
import { InvoiceDocument } from "@/components/admin/finance/invoice-document";
import { InvoicePayments } from "@/components/admin/finance/invoice-payments";
import type { InvoiceEditorContext } from "@/lib/api/finance";
import { formatFcfa } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/api/types";

/** Panneau qui glisse depuis la droite : aperçu de la facture en haut,
 * versements (saisie et réception) en dessous. La facture affichée est
 * gardée pendant la fermeture, pour que le contenu ne disparaisse pas avant
 * la fin de l'animation. */
export function InvoiceViewer({
  invoice,
  settings,
  onClose,
  onChanged,
  onPdf,
}: {
  invoice: Invoice | null;
  settings: InvoiceEditorContext["settings"] | null;
  onClose: () => void;
  /** Après un versement : recharge la liste (et donc le montant payé). */
  onChanged: () => void;
  onPdf: () => void;
}) {
  const [shown, setShown] = useState<Invoice | null>(invoice);
  if (invoice && invoice !== shown) setShown(invoice);
  const current = invoice ?? shown;
  const remaining = current ? Math.max(Number(current.amount_ttc) - Number(current.amount_paid), 0) : 0;

  return (
    <Dialog.Root open={!!invoice} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-3xl flex-col bg-white shadow-2xl",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full"
          )}
        >
          {current && (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-neutral-100 px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="truncate text-lg font-semibold text-neutral-900">{current.invoice_number}</Dialog.Title>
                  <p className="truncate text-xs text-neutral-500">
                    {current.client_name || "Sans client"}
                    {current.quote_number ? ` · devis ${current.quote_number}` : ""}
                  </p>
                </div>
                <Dialog.Close
                  aria-label="Fermer"
                  className="order-first rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 sm:order-last"
                >
                  <X className="size-4" />
                </Dialog.Close>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  {current.status === "BROUILLON" && (
                    <Link
                      href={`/admin/finance/facturation/${current.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                    >
                      <Pencil className="size-3.5" /> Modifier
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={onPdf}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="size-3.5" /> Télécharger le PDF
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-neutral-50/60">
                {/* Aperçu de la facture */}
                <section className="flex justify-center px-4 pt-5 sm:px-6">
                  {settings ? (
                    <DocumentPreviewCards
                      pageCount={1}
                      maxScale={0.8}
                      renderPage={() => (
                        <InvoiceDocument
                          invoice={{
                            invoice_number: current.invoice_number,
                            client_name: current.client_name,
                            issue_date: current.issue_date,
                            lines: current.lines.length
                              ? current.lines
                              : [{ description: current.quote_number ? `Prestations — devis ${current.quote_number}` : "Prestations", quantity: "1", unit_price: current.amount_ht }],
                            discount_amount: current.lines.length ? Number(current.discount_amount) : 0,
                            discount_reason: current.discount_reason,
                            vat_rate: Number(current.vat_rate),
                            amount_paid: Number(current.amount_paid),
                            quote_number: current.quote_number,
                          }}
                          settings={settings}
                          accentColor={current.document_color || "#123f91"}
                        />
                      )}
                    />
                  ) : (
                    <p className="py-10 text-sm text-neutral-400">Aperçu indisponible.</p>
                  )}
                </section>

                {/* Versements */}
                <section className="mx-4 mt-6 mb-6 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:mx-6 sm:p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                      <Wallet className="size-4 text-primary" /> Versements
                    </h3>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", remaining > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700")}>
                      {remaining > 0 ? `Reste ${formatFcfa(remaining)}` : "Payée"}
                    </span>
                  </div>
                  <InvoicePayments key={current.id} invoice={current} onChanged={onChanged} />
                </section>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
