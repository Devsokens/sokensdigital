"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

const SPOTLIGHT_PADDING = 8;
const TOOLTIP_GAP = 16;
const TOOLTIP_WIDTH = 320;

export type SpotlightPlacement = "right" | "bottom-start" | "bottom-end";

function getTooltipPosition(rect: DOMRect, placement: SpotlightPlacement) {
  const maxLeft = (typeof window !== "undefined" ? window.innerWidth : 1280) - TOOLTIP_WIDTH - 16;
  let top: number;
  let left: number;

  if (placement === "right") {
    top = Math.max(16, rect.top);
    left = rect.right + TOOLTIP_GAP;
  } else if (placement === "bottom-end") {
    top = rect.bottom + TOOLTIP_GAP;
    left = rect.right - TOOLTIP_WIDTH;
  } else {
    top = rect.bottom + TOOLTIP_GAP;
    left = rect.left;
  }

  return { top, left: Math.min(Math.max(16, left), maxLeft) };
}

export interface SpotlightOverlayProps {
  /** Null/undefined hides the overlay (target not found or nothing active). */
  rect: DOMRect | null;
  placement: SpotlightPlacement;
  title: string;
  description: string;
  /** Small counter text in the tooltip's top-left, e.g. "2 / 5". Omit for single-step tours. */
  meta?: string;
  /** Footer buttons — differs between the multi-step chrome tour and single-step module tours. */
  footer: ReactNode;
  onDismiss: () => void;
  /** Unique per distinct step, so the tooltip re-animates in/out when it changes target. */
  tooltipKey: string;
}

/** Shared visual engine for both the chrome onboarding tour and per-module
 * spotlight tours: a dark backdrop, a brightened halo over the target (via
 * `backdrop-filter`, so no exact DOM cutout is needed), and a tooltip card.
 * `layout` on the halo lets motion animate between two different rects
 * smoothly when the target changes without either side re-mounting it. */
export function SpotlightOverlay({
  rect,
  placement,
  title,
  description,
  meta,
  footer,
  onDismiss,
  tooltipKey,
}: SpotlightOverlayProps) {
  return (
    <AnimatePresence>
      {rect && (
        <>
          <motion.div
            key="spotlight-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-neutral-950/70"
            onClick={onDismiss}
          />

          <motion.div
            key="spotlight-ring"
            layout
            initial={false}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              position: "fixed",
              top: rect.top - SPOTLIGHT_PADDING,
              left: rect.left - SPOTLIGHT_PADDING,
              width: rect.width + SPOTLIGHT_PADDING * 2,
              height: rect.height + SPOTLIGHT_PADDING * 2,
              backdropFilter: "brightness(1.5) saturate(1.15)",
            }}
            className="pointer-events-none z-[101] rounded-2xl shadow-[0_0_0_2px_rgba(255,255,255,0.8),0_0_30px_6px_rgba(255,255,255,0.15)]"
          />

          <motion.div
            key={`spotlight-tooltip-${tooltipKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            style={{ position: "fixed", width: TOOLTIP_WIDTH, ...getTooltipPosition(rect, placement) }}
            className="z-[102] rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl shadow-black/20"
          >
            <div className="mb-2 flex items-center justify-between">
              {meta ? <span className="text-xs font-medium text-neutral-400">{meta}</span> : <span />}
              <button
                onClick={onDismiss}
                aria-label="Fermer"
                className="text-neutral-400 transition-colors hover:text-neutral-700"
              >
                <X className="size-4" />
              </button>
            </div>
            <p className="mb-1 text-sm font-semibold text-neutral-900">{title}</p>
            <p className="mb-4 text-sm text-neutral-500">{description}</p>
            {footer}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
