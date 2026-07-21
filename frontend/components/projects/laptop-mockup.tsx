"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MockupScene, type SceneVariant } from "@/components/projects/mockup-scenes";

type Props = {
  title: string;
  videoSrc?: string;
  images?: string[];
  sceneVariants?: SceneVariant[];
};

/**
 * A floating laptop mockup — idles with a slow, continuous drift/tilt so it
 * never feels static, and its screen cycles through the project's real
 * uploaded images with a crossfade + slow Ken Burns zoom for a "video-like"
 * feel. Falls back to a real video, then to the same animated placeholder
 * scenes as ProjectMedia when no assets exist yet — same priority order,
 * just a different frame around the content.
 */
export function LaptopMockup({ title, videoSrc, images, sceneVariants }: Props) {
  return (
    <motion.div
      className="relative mx-auto w-full max-w-md [perspective:1200px]"
      animate={{ y: [0, -10, 0], rotate: [-1.2, 1.2, -1.2] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Screen */}
      <div className="relative overflow-hidden rounded-t-xl border border-white/15 border-b-0 bg-neutral-900 p-[6px] shadow-2xl shadow-black/40">
        <div className="relative aspect-video overflow-hidden rounded-[4px] bg-black">
          {videoSrc ? (
            <video
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : images && images.length > 0 ? (
            <ImageReel title={title} images={images} />
          ) : (
            <PlaceholderReel variants={sceneVariants ?? ["chart"]} />
          )}
        </div>
        {/* Webcam notch */}
        <span className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10" />
      </div>

      {/* Base / keyboard deck */}
      <div className="relative h-3 rounded-b-[10px] bg-gradient-to-b from-neutral-700 to-neutral-800 shadow-lg shadow-black/30">
        <div className="absolute inset-x-0 top-0 h-px bg-white/10" />
        <div className="mx-auto h-1.5 w-16 rounded-b-md bg-neutral-900/60" />
      </div>

      {/* Soft ground shadow, drifts opposite the float for a grounded feel */}
      <motion.div
        aria-hidden
        className="mx-auto mt-3 h-3 w-4/5 rounded-full bg-black/40 blur-md"
        animate={{ scaleX: [1, 0.88, 1], opacity: [0.5, 0.3, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

function ImageReel({ title, images }: { title: string; images: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 4000);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <AnimatePresence mode="sync">
      <motion.img
        key={images[index]}
        src={images[index]}
        alt={title}
        initial={{ opacity: 0, scale: 1.06 }}
        animate={{ opacity: 1, scale: 1.14 }}
        exit={{ opacity: 0 }}
        transition={{
          opacity: { duration: 1, ease: [0.16, 1, 0.3, 1] },
          scale: { duration: 4, ease: "linear" },
        }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </AnimatePresence>
  );
}

function PlaceholderReel({ variants }: { variants: SceneVariant[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (variants.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % variants.length), 4500);
    return () => clearInterval(id);
  }, [variants.length]);

  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary),transparent_75%),transparent_60%),linear-gradient(135deg,oklch(0.16_0.02_235),oklch(0.08_0.01_240))]">
      <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:24px_24px]" />
      <AnimatePresence mode="wait">
        <motion.div
          key={variants[index]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0"
        >
          <MockupScene variant={variants[index]} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
