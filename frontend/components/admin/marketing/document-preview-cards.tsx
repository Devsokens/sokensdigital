"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
}: {
  pageCount: number;
  renderPage: (pageIndex: number) => React.ReactNode;
  /** Échelle maximale de la page A4 (0.55 dans une colonne d'éditeur). */
  maxScale?: number;
  /** Part de la hauteur de l'écran que la page ne doit pas dépasser (0.4 =
   * 40 %) — pour laisser voir ce qui suit sans défiler. */
  maxViewportHeight?: number;
}) {
  const [active, setActive] = useState(0);
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
        <div ref={frameRef} className="w-full overflow-hidden bg-neutral-100" style={{ height: Math.round(PAGE_H * scale) }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {renderPage(current)}
          </div>
        </div>

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
