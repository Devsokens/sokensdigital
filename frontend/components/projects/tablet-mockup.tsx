"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BlueprintDiagram } from "@/components/sections/expertise/blueprint-diagram";

const KEN_BURNS_DURATION = 6;

/**
 * A floating tablet mockup — fully automatic, cinematic "Ken Burns" style:
 * the device drifts with real 3D depth (rotateX/rotateY), and whichever
 * visual is on screen (blueprint diagram or uploaded image) slowly
 * zooms/pans on its own. Swapping between diagram and image is a soft
 * crossfade, not a hard cut. `object-contain` so the full image is always
 * visible, never cropped.
 */
export function TabletMockup({ imageUrl }: { imageUrl?: string }) {
  const [showImage, setShowImage] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;
    const id = setInterval(() => setShowImage((v) => !v), KEN_BURNS_DURATION * 1000);
    return () => clearInterval(id);
  }, [imageUrl]);

  return (
    <motion.div
      className="relative mx-auto w-full max-w-sm [perspective:1200px]"
      animate={{ y: [0, -9, 0], rotateY: [4, -4, 4], rotateX: [1.5, -1.5, 1.5] }}
      transition={{ duration: 6.5, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="relative overflow-hidden rounded-[22px] border-[10px] border-neutral-900 bg-neutral-900 shadow-2xl shadow-black/40 ring-1 ring-white/10">
        <span className="absolute top-1 left-1/2 z-10 size-1 -translate-x-1/2 rounded-full bg-white/20" />
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[12px] bg-black">
          <AnimatePresence mode="sync">
            {!showImage && (
              <motion.div
                key="diagram"
                className="absolute inset-0 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              >
                <BlueprintDiagram />
              </motion.div>
            )}
            {imageUrl && showImage && (
              <motion.div
                key="image"
                className="absolute inset-0 overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.img
                  src={imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                  initial={{ scale: 1, x: 0, y: 0 }}
                  animate={{ scale: 1.09, x: -10, y: 6 }}
                  transition={{ duration: KEN_BURNS_DURATION, ease: "easeOut" }}
                />
              </motion.div>
            )}
          </AnimatePresence>
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
