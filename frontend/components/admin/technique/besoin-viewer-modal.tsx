"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Download, FileText, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchBesoinPdf, fetchQuoteFile, getDisbursementRequest, saveBlob } from "@/lib/api/finance";
import type { DisbursementRequest } from "@/lib/api/types";

type Doc =
  | { kind: "bon"; key: "bon"; label: string; filename: string }
  | { kind: "quote"; key: string; label: string; filename: string; url: string };

function previewable(blob: Blob) {
  return blob.type === "application/pdf" || blob.type.startsWith("image/");
}

/** Visionneuse d'un besoin — même esprit que QuoteViewerModal (marketing) :
 * le document s'affiche dans la page, avec « Télécharger » dans la barre.
 * Un onglet pour le bon de demande (PDF généré) et un par devis joint. */
export function BesoinViewerModal({ request, onClose }: { request: DisbursementRequest; onClose: () => void }) {
  const [detail, setDetail] = useState<DisbursementRequest | null>(null);
  const [activeKey, setActiveKey] = useState("bon");
  // Le document affiché, remonté par DocPreview pour le bouton Télécharger.
  const [blob, setBlob] = useState<Blob | null>(null);

  const title = request.reference ?? "Besoin";

  // Le détail porte les URLs signées des devis (valables quelques minutes).
  useEffect(() => {
    getDisbursementRequest(request.id).then(setDetail).catch(() => setDetail(request));
  }, [request]);

  const docs: Doc[] = [
    { kind: "bon", key: "bon", label: "Bon de demande", filename: `${title}.pdf` },
    ...(detail?.quotes ?? []).map((q) => ({
      kind: "quote" as const,
      key: q.id,
      label: q.original_filename,
      filename: q.original_filename,
      url: q.url,
    })),
  ];
  const active = docs.find((d) => d.key === activeKey) ?? docs[0];

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
            "fixed top-1/2 left-1/2 z-50 flex h-[92vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl",
            "transition-all duration-200 ease-out",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
          )}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-5 py-3.5">
            <Dialog.Title className="truncate text-sm font-semibold text-neutral-900">
              {title} — {active.label}
            </Dialog.Title>
            <div className="flex items-center gap-2">
              <Button onClick={() => blob && saveBlob(blob, active.filename)} disabled={!blob} className="gap-1.5 rounded-full px-4">
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

          {docs.length > 1 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/10 px-4 py-2">
              {docs.map((doc) => (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => {
                    setBlob(null);
                    setActiveKey(doc.key);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    doc.key === active.key ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  )}
                >
                  {doc.kind === "bon" ? <FileText className="size-3.5" /> : <Paperclip className="size-3.5" />}
                  <span className="max-w-48 truncate">{doc.label}</span>
                </button>
              ))}
            </div>
          )}

          <DocPreview
            key={active.key}
            label={active.label}
            load={() => (active.kind === "bon" ? fetchBesoinPdf(request.id) : fetchQuoteFile(active.url))}
            onLoaded={setBlob}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Charge et affiche un document. Monté avec `key` = le document : changer
 * d'onglet repart d'un état vierge, sans remise à zéro manuelle. */
function DocPreview({
  label,
  load,
  onLoaded,
}: {
  label: string;
  load: () => Promise<Blob>;
  onLoaded: (blob: Blob) => void;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    load()
      .then((b) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(b);
        setBlob(b);
        setObjectUrl(createdUrl);
        onLoaded(b);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Document indisponible.");
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
    // Chargé une fois par montage (le parent remonte via `key`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex-1 bg-neutral-200">
      {error ? (
        <div className="flex size-full items-center justify-center p-6 text-center text-sm text-neutral-600">{error}</div>
      ) : !blob || !objectUrl ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : blob.type.startsWith("image/") ? (
        <div className="flex size-full items-center justify-center overflow-auto p-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- Blob local, pas une image optimisable */}
          <img src={objectUrl} alt={label} className="max-h-full max-w-full rounded-lg bg-[#fff] shadow" />
        </div>
      ) : previewable(blob) ? (
        <iframe src={objectUrl} title={label} className="size-full border-0" />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center text-sm text-neutral-600">
          <Paperclip className="size-6 text-neutral-400" />
          Aperçu indisponible pour ce type de fichier — utilisez « Télécharger ».
        </div>
      )}
    </div>
  );
}
