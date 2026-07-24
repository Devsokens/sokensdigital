"use client";

import { useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Opens a devis like a mail client opens a PDF attachment — an in-page
 * lightbox with the document rendered inline and a "Télécharger" action in
 * the toolbar, instead of navigating away to a new tab. The iframe points
 * at the same print page used for the standalone /imprimer route (?embed=1
 * just hides that page's own toolbar, see quote-print-view.tsx) so the
 * print layout/CSS is defined exactly once. */
export function QuoteViewerModal({
  quoteId,
  quoteNumber,
  onClose,
}: {
  quoteId: string;
  quoteNumber: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);

  function handleDownload() {
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex h-[92vh] w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",
            "transition-all duration-200 ease-out",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 py-3.5">
            <Dialog.Title className="text-sm font-semibold text-neutral-900">
              Devis {quoteNumber}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <Button onClick={handleDownload} className="gap-1.5 rounded-full px-4">
                <Download className="size-4" /> Télécharger
              </Button>
              <Dialog.Close
                aria-label="Fermer"
                className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
          </div>

          <div className="relative flex-1 bg-neutral-200">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-6 animate-spin text-neutral-400" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={`/admin/marketing/devis/${quoteId}/imprimer?embed=1`}
              title={`Devis ${quoteNumber}`}
              className="size-full border-0"
              onLoad={() => setLoading(false)}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
