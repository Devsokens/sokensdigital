"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye } from "lucide-react";
import { BlueprintDiagram } from "@/components/sections/expertise/blueprint-diagram";

/**
 * A floating tablet mockup — same idea as LaptopMockup (never static, always
 * a slow idle drift) but for a single hero visual rather than a cycling
 * gallery. Shows the animated blueprint diagram until clicked; a click
 * triggers an iris wipe that expands from the center until the image fills
 * the whole screen. `object-contain` (not `object-cover`) so the full
 * image is always visible, never cropped.
 */
export function TabletMockup({ imageUrl }: { imageUrl?: string }) {
  const [revealed, setRevealed] = useState(false);
  const showImage = imageUrl && revealed;

  return (
    <motion.div
      className="relative mx-auto w-full max-w-sm [perspective:1200px]"
      animate={{ y: [0, -9, 0], rotate: [1.4, -1.4, 1.4] }}
      transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="relative overflow-hidden rounded-[22px] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <span className="absolute top-1 left-1/2 z-10 size-1 -translate-x-1/2 rounded-full bg-white/20" />
        <button
          type="button"
          disabled={!imageUrl || revealed}
          onClick={() => setRevealed(true)}
          className="relative block aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-black"
        >
          <div className="absolute inset-0 p-4">
            <BlueprintDiagram />
          </div>

          {imageUrl && !revealed && (
            <span className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100">
              <span className="flex size-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
                <Eye className="size-5" />
              </span>
              <span className="text-xs font-medium">Cliquer pour voir</span>
            </span>
          )}

          <AnimatePresence>
            {showImage && (
              <motion.div
                key="reveal"
                className="absolute inset-0 bg-black"
                initial={{ clipPath: "circle(0% at 50% 50%)" }}
                animate={{ clipPath: "circle(150% at 50% 50%)" }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              >
                <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
      </div>

      <motion.div
        aria-hidden
        className="mx-auto mt-3 h-2.5 w-3/5 rounded-full bg-black/40 blur-md"
        animate={{ scaleX: [1, 0.85, 1], opacity: [0.45, 0.25, 0.45] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}
