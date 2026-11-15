"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Loader2, Mail, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getQuote, getQuoteSettings, sendQuote } from "@/lib/api/marketing";
import type { Lead, Quote, QuoteSettings } from "@/lib/api/types";
import { QuoteDocumentPages } from "@/components/admin/marketing/quote-document-pages";
import { SendDocumentModal } from "@/components/admin/marketing/send-document-modal";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
};

export function QuoteViewerModal({
  quoteId,
  quoteNumber,
  initialQuote,
  onClose,
  onStatusChanged,
}: {
  quoteId: string;
  quoteNumber: string;
  initialQuote?: Quote | null;
  onClose: () => void;
  onStatusChanged?: (updated: Quote) => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(initialQuote || null);
  const [settings, setSettings] = useState<QuoteSettings | null>(null);
  const [loading, setLoading] = useState(!initialQuote);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(0.85);
  const pagesAreaRef = useRef<HTMLDivElement>(null);

  // À l'ouverture, la page A4 (793 px) est ajustée à la largeur disponible :
  // lisible en entier sur téléphone, 85 % sur grand écran. Le zoom reste libre ensuite.
  useEffect(() => {
    const width = pagesAreaRef.current?.clientWidth;
    if (!width) return;
    const fit = Number(Math.min(0.85, (width - 24) / 793).toFixed(2));
    const frame = requestAnimationFrame(() => setScale(fit));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [sendOpen, setSendOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      initialQuote ? Promise.resolve(initialQuote) : getQuote(quoteId),
      getQuoteSettings(),
    ])
      .then(([q, s]) => {
        setQuote(q);
        setSettings(s);
        setLoading(false);
      })
      .catch(() => {
        setError("Impossible de charger les données du devis.");
        setLoading(false);
      });
  }, [quoteId, initialQuote]);

  function handlePrint() {
    window.print();
  }

  async function handleSendEmail(emails: string[], message: string) {
    if (!quote) return;
    const updated = await sendQuote(quote.id, {
      recipient_emails: emails,
      message,
    });
    if (updated.email_warning) alert(updated.email_warning);
    setQuote(updated);
    if (onStatusChanged) onStatusChanged(updated);
  }

  // Extraire les emails rattachés au lead / contact
  const suggestedEmails: string[] = [];
  const leadObj = typeof quote?.lead === "object" && quote?.lead ? (quote.lead as Lead) : null;
  if (leadObj?.email) suggestedEmails.push(leadObj.email);
  if (leadObj?.contacts) {
    leadObj.contacts.forEach((c) => {
      if (c.email && !suggestedEmails.includes(c.email)) {
        suggestedEmails.push(c.email);
      }
    });
  }

  return (
    <>
      <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
        <Dialog.Portal>
          <Dialog.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-200 print:hidden",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
            )}
          />
          <Dialog.Popup
            className={cn(
              "fixed top-1/2 left-1/2 z-50 flex h-dvh w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden bg-[#dfe1e6] shadow-2xl sm:h-[94vh] sm:w-[calc(100%-2rem)] sm:rounded-2xl print:m-0 print:h-auto print:w-full print:max-w-none print:translate-x-0 print:translate-y-0 print:rounded-none print:bg-white print:p-0",
              "transition-all duration-200 ease-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            {/* Barre d'outils du visualiseur */}
            {/* Téléphone : titre et fermeture en haut, outils dessous ; libellés
              * des boutons réduits à leur icône. */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-neutral-300 bg-white px-3 py-2.5 shadow-sm sm:px-5 sm:py-3 print:hidden">
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                <Dialog.Title className="text-base font-semibold text-neutral-900">
                  Devis {quote?.quote_number || quoteNumber}
                </Dialog.Title>
                {quote?.client_name && (
                  <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                    {quote.client_name}
                  </span>
                )}
                {quote && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      quote.status === "ACCEPTE"
                        ? "bg-emerald-100 text-emerald-800"
                        : quote.status === "ENVOYE"
                        ? "bg-sky-100 text-sky-800"
                        : "bg-neutral-100 text-neutral-600"
                    )}
                  >
                    {STATUS_LABELS[quote.status] ?? quote.status}
                  </span>
                )}
              </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                {/* Contrôles de zoom */}
                <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-50 px-1 py-0.5 sm:mr-2">
                  <button
                    type="button"
                    onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.1).toFixed(2))))}
                    aria-label="Zoom arrière"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                  >
                    <ZoomOut className="size-3.5" />
                  </button>
                  <span className="px-2 text-xs font-mono font-medium text-neutral-600">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setScale((s) => Math.min(1.4, Number((s + 0.1).toFixed(2))))}
                    aria-label="Zoom avant"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                  >
                    <ZoomIn className="size-3.5" />
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSendOpen(true)}
                  aria-label="Envoyer par mail"
                  className="ml-auto gap-1.5 rounded-full px-3 text-xs sm:ml-0 sm:px-3.5"
                >
                  <Mail className="size-3.5 text-neutral-600" /> <span className="hidden sm:inline">Envoyer par mail</span>
                  <span className="sm:hidden">Envoyer</span>
                </Button>

                <Button
                  type="button"
                  onClick={handlePrint}
                  aria-label="Imprimer ou télécharger en PDF"
                  className="gap-1.5 rounded-full px-3 text-xs shadow-sm sm:px-4"
                >
                  <Printer className="size-3.5" /> <span className="hidden sm:inline">Imprimer / Télécharger en PDF</span>
                  <span className="sm:hidden">PDF</span>
                </Button>

                <Dialog.Close
                  aria-label="Fermer"
                  className="hidden rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 sm:block"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>
              <Dialog.Close
                aria-label="Fermer"
                className="order-first ml-auto rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 sm:hidden"
              >
                <X className="size-5" />
              </Dialog.Close>
            </div>

            {/* Zone d'affichage défilable des pages A4 */}
            <div ref={pagesAreaRef} className="relative flex-1 overflow-auto p-3 sm:p-6 print:overflow-visible print:p-0">
              {loading && (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-neutral-400" />
                </div>
              )}

              {error && (
                <div className="mx-auto my-8 max-w-md rounded-xl bg-white p-6 text-center shadow">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {quote && settings && (
                <div
                  id="printable-quote-area"
                  className="flex flex-col items-center gap-6 [zoom:var(--quote-zoom)] print:gap-0 print:[zoom:1]"
                  style={{ "--quote-zoom": scale } as React.CSSProperties}
                >
                  <QuoteDocumentPages
                    quote={quote}
                    settings={settings}
                    accentColor={quote.document_color || "#123f91"}
                  />
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal d'envoi par e-mail */}
      {quote && (
        <SendDocumentModal
          open={sendOpen}
          onOpenChange={setSendOpen}
          documentTitle={`Devis ${quote.quote_number}`}
          documentNumber={quote.quote_number}
          recipientName={quote.client_name}
          suggestedEmails={suggestedEmails}
          onSend={handleSendEmail}
        />
      )}
    </>
  );
}
