"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

// Natural A4 page size at 96dpi (matches document-print-primitives.tsx's
// Page component: 210mm/297mm).
const PAGE_W = 793;
const PAGE_H = 1122;
/** Échelle par défaut sur grand écran ; sur téléphone la carte rétrécit à
 * la largeur disponible (l'échelle baisse d'autant). */
const DEFAULT_MAX_SCALE = 0.55;

/** The document pages as a carousel card in the (right-hand, alongside
 * the form) preview column — one page shown at a time, large enough to
 * actually read, with arrow + dot navigation between pages. */
export function DocumentPreviewCards({
  pageCount,
  renderPage,
  maxScale = DEFAULT_MAX_SCALE,
  maxViewportHeight,
  zoomable = false,
}: {
  pageCount: number;
  renderPage: (pageIndex: number) => React.ReactNode;
  /** Échelle maximale de la page A4 (0.55 dans une colonne d'éditeur). */
  maxScale?: number;
  /** Part de la hauteur de l'écran que la page ne doit pas dépasser (0.4 =
   * 40 %) — pour laisser voir ce qui suit sans défiler. */
  maxViewportHeight?: number;
  /** Loupe (et clic sur la page) pour l'ouvrir en grand, avec zoom. */
  zoomable?: boolean;
}) {
  const [active, setActive] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const current = Math.min(active, pageCount - 1);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(maxScale);
  // Plafond venant de la hauteur de l'écran (recalculé au redimensionnement).
  const [heightCap, setHeightCap] = useState(maxScale);

  useEffect(() => {
    if (!maxViewportHeight) return;
    const update = () => setHeightCap((window.innerHeight * maxViewportHeight) / PAGE_H);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [maxViewportHeight]);

  const cap = Math.min(maxScale, heightCap);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(cap, entry.contentRect.width / PAGE_W));
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [cap]);

  return (
    <div className="w-full" style={{ maxWidth: Math.round(PAGE_W * cap) }}>
      <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div
          ref={frameRef}
          className={cn("w-full overflow-hidden bg-neutral-100", zoomable && "cursor-zoom-in")}
          style={{ height: Math.round(PAGE_H * scale) }}
          onClick={zoomable ? () => setZoomOpen(true) : undefined}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {renderPage(current)}
          </div>
        </div>

        {zoomable && (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="Agrandir l'aperçu"
            title="Agrandir"
            className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-md hover:bg-white"
          >
            <Maximize2 className="size-4" />
          </button>
        )}

        {pageCount > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((p) => (p - 1 + pageCount) % pageCount)}
              aria-label="Page précédente"
              className="absolute top-1/2 left-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-md hover:bg-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setActive((p) => (p + 1) % pageCount)}
              aria-label="Page suivante"
              className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-md hover:bg-white"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}

        <p className="border-t border-neutral-100 px-3 py-1.5 text-center text-[0.65rem] font-medium text-neutral-400">
          Page {current + 1} / {pageCount}
        </p>
      </div>

      {zoomable && (
        <ZoomedPage open={zoomOpen} onOpenChange={setZoomOpen}>
          {renderPage(current)}
        </ZoomedPage>
      )}

      {pageCount > 1 && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Page ${i + 1}`}
              className={cn("size-1.5 rounded-full transition-colors", i === current ? "bg-primary" : "bg-neutral-300 hover:bg-neutral-400")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** La page en grand, par-dessus tout : ajustée à la largeur de l'écran à
 * l'ouverture (100 % au plus), puis zoom −/+ de 40 % à 200 %. */
function ZoomedPage({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) return;
    const fit = Math.min(1, (window.innerWidth - 48) / PAGE_W);
    const frame = requestAnimationFrame(() => setZoom(Number(fit.toFixed(2))));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const step = (delta: number) => setZoom((z) => Math.min(2, Math.max(0.4, Number((z + delta).toFixed(2)))));

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-0 z-[60] flex flex-col transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">
          <Dialog.Title className="sr-only">Aperçu agrandi</Dialog.Title>
          <div className="flex shrink-0 items-center justify-end gap-2 px-4 py-3">
            <div className="flex items-center rounded-full bg-white px-1 py-0.5 shadow">
              <button type="button" onClick={() => step(-0.1)} aria-label="Zoom arrière" className="rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100">
                <ZoomOut className="size-4" />
              </button>
              <span className="w-12 text-center font-mono text-xs text-neutral-700">{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => step(0.1)} aria-label="Zoom avant" className="rounded-full p-1.5 text-neutral-600 hover:bg-neutral-100">
                <ZoomIn className="size-4" />
              </button>
            </div>
            <Dialog.Close aria-label="Fermer" className="rounded-full bg-white p-2 text-neutral-700 shadow hover:bg-neutral-100">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-6" onClick={(e) => e.target === e.currentTarget && onOpenChange(false)}>
            <div className="mx-auto w-fit shadow-2xl [zoom:var(--page-zoom)]" style={{ "--page-zoom": zoom } as React.CSSProperties}>
              {children}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
