"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MockupScene, type SceneVariant } from "@/components/projects/mockup-scenes";

type Props = {
  title: string;
  icon: LucideIcon;
  videoSrc?: string;
  images?: string[];
  sceneVariants?: SceneVariant[];
  className?: string;
};

/**
 * Renders a project's live preview. Priority: real video > real screenshots
 * (auto-cycled) > animated placeholder scenes that still feel "alive" while
 * no asset has been uploaded from the back office yet.
 */
export function ProjectMedia({
  title,
  videoSrc,
  images,
  sceneVariants,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-2xl border border-white/10",
        className
      )}
    >
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
        <ImageCycle title={title} images={images} />
      ) : (
        <AnimatedPlaceholder variants={sceneVariants ?? ["chart"]} />
      )}
    </div>
  );
}

function ImageCycle({ title, images }: { title: string; images: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 3500);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div className="absolute inset-0 bg-black">
      <AnimatePresence mode="sync">
        <motion.img
          key={images[index]}
          src={images[index]}
          alt={title}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] as const }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </AnimatePresence>
    </div>
  );
}

function AnimatedPlaceholder({ variants }: { variants: SceneVariant[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (variants.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % variants.length), 4500);
    return () => clearInterval(id);
  }, [variants.length]);

  return (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklch,var(--primary),transparent_75%),transparent_60%),linear-gradient(135deg,oklch(0.16_0.02_235),oklch(0.08_0.01_240))]">
      <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:28px_28px]" />

      <motion.div
        aria-hidden
        className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-primary/10 to-transparent"
        animate={{ top: ["-15%", "115%"] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={variants[index]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
          className="absolute inset-0"
        >
          <MockupScene variant={variants[index]} />
        </motion.div>
      </AnimatePresence>

      <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
        </span>
        <span className="text-[10px] font-medium tracking-wide text-white/70 uppercase">
          Aperçu
        </span>
      </div>
    </div>
  );
}
