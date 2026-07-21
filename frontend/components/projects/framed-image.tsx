"use client";

import { motion } from "motion/react";

export const KEN_BURNS_DURATION = 6;

/**
 * Fills its container edge-to-edge with no empty gaps (a blurred, scaled
 * copy of the image behind) while the real image itself stays fully
 * visible via `object-contain` on top — never cropped, never letterboxed.
 * The foreground slowly zooms/pans (Ken Burns) for a subtle cinematic feel.
 */
export function FramedImage({
  src, alt = "", pan = { x: 0, y: 0 },
}: { src: string; alt?: string; pan?: { x: number; y: number } }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-2xl"
      />
      <motion.img
        src={src}
        alt={alt}
        className="absolute inset-0 h-full w-full object-contain"
        initial={{ scale: 1, x: 0, y: 0 }}
        animate={{ scale: 1.09, x: pan.x, y: pan.y }}
        transition={{ duration: KEN_BURNS_DURATION, ease: "easeOut" }}
      />
    </div>
  );
}
