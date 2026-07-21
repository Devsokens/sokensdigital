"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BlueprintDiagram } from "@/components/sections/expertise/blueprint-diagram";
import { FramedImage, KEN_BURNS_DURATION } from "@/components/projects/framed-image";

/**
 * A floating tablet mockup — fully automatic, cinematic "Ken Burns" style:
 * the device drifts with real 3D depth (rotateX/rotateY). With no images
 * it shows the animated blueprint diagram; once one or more images are
 * set, it auto-reveals them and — with several — cycles through them like
 * a slideshow, each one filling the screen edge-to-edge (blurred backdrop)
 * while staying fully visible on top (never cropped).
 */
export function TabletMockup({ images }: { images?: string[] }) {
  const hasImages = Boolean(images && images.length > 0);
  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const showReal = hasImages && revealed;

  useEffect(() => {
    setRevealed(false);
    setIndex(0);
    if (!hasImages) return;
    const id = setTimeout(() => setRevealed(true), 1200);
    return () => clearTimeout(id);
  }, [hasImages]);

  useEffect(() => {
    if (!showReal || !images || images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), KEN_BURNS_DURATION * 1000);
    return () => clearInterval(id);
  }, [showReal, images]);

  const pan = index % 2 === 0 ? { x: -10, y: 6 } : { x: 10, y: -6 };

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
            {!showReal && (
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
            {showReal && (
              <motion.div
                key={images![index]}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              >
                <FramedImage src={images![index]} pan={pan} />
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
