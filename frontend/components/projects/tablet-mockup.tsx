"use client";

import { motion } from "motion/react";
import { BlueprintDiagram } from "@/components/sections/expertise/blueprint-diagram";

/**
 * A floating tablet mockup — same idea as LaptopMockup (never static, always
 * a slow idle drift) but for a single hero visual rather than a cycling
 * gallery. Shows an uploaded image with a slow Ken Burns zoom if set,
 * otherwise falls back to the animated blueprint diagram.
 */
export function TabletMockup({ imageUrl }: { imageUrl?: string }) {
  return (
    <motion.div
      className="relative mx-auto w-full max-w-sm [perspective:1200px]"
      animate={{ y: [0, -9, 0], rotate: [1.4, -1.4, 1.4] }}
      transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="relative overflow-hidden rounded-[22px] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <span className="absolute top-1 left-1/2 z-10 size-1 -translate-x-1/2 rounded-full bg-white/20" />
        <div className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-black">
          {imageUrl ? (
            <motion.img
              src={imageUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ scale: 1 }}
              animate={{ scale: 1.07 }}
              transition={{ duration: 9, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
            />
          ) : (
            <div className="absolute inset-0 p-4">
              <BlueprintDiagram />
            </div>
          )}
        </div>
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
