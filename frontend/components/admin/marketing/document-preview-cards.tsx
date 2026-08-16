"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Natural A4 page size at 96dpi (matches document-print-primitives.tsx's
// Page component: 210mm/297mm).
const PAGE_W = 793;
const PAGE_H = 1122;
const SCALE = 0.55;
const CARD_WIDTH = Math.round(PAGE_W * SCALE);
const CARD_HEIGHT = Math.round(PAGE_H * SCALE);

/** The document pages as a carousel card in the (right-hand, alongside
 * the form) preview column — one page shown at a time, large enough to
 * actually read, with arrow + dot navigation between pages. */
export function DocumentPreviewCards({
  pageCount,
  renderPage,
}: {
  pageCount: number;
  renderPage: (pageIndex: number) => React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const current = Math.min(active, pageCount - 1);

  return (
    <div className="w-fit">
      <div className="relative overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-hidden bg-neutral-100" style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
          <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
            {renderPage(current)}
          </div>
        </div>

        {pageCount > 1 && (
          <>
            <button
              type="button"
              onClick={() => setActive((p) => (p - 1 + pageCount) % pageCount)}
              aria-label="Page précédente"
              className="absolute top-1/2 left-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-md hover:bg-white"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setActive((p) => (p + 1) % pageCount)}
              aria-label="Page suivante"
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-700 shadow-md hover:bg-white"
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
