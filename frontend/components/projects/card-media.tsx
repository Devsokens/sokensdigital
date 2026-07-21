"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { SectionIcon } from "@/components/dynamic-icon";

const CYCLE_DURATION = 4500;

type Props = {
  images?: string[];
  videoSrc?: string;
  icon: string;
};

/** Small-card media (project grid, related projects, admin card view) —
 * video first, else the uploaded images auto-cycling with a soft
 * crossfade + gentle zoom-in, else the abstract icon-on-gradient
 * placeholder. Fills its `relative` parent (`absolute inset-0`). Plain
 * `object-cover` on purpose: unlike the big hero/tablet mockups, a
 * cropped thumbnail is the expected look for a grid card. */
export function ProjectCardMedia({ images, videoSrc, icon }: Props) {
  const hasImages = Boolean(images && images.length > 0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!hasImages || !images || images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), CYCLE_DURATION);
    return () => clearInterval(id);
  }, [hasImages, images]);

  if (videoSrc) {
    return (
      <video
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    );
  }

  if (hasImages) {
    return (
      <AnimatePresence mode="sync">
        <motion.img
          key={images![index]}
          src={images![index]}
          alt=""
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </AnimatePresence>
    );
  }

  return (
    <div
      aria-hidden
      className="absolute inset-0 bg-[radial-gradient(circle_at_65%_25%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_60%),linear-gradient(150deg,oklch(0.17_0.02_235),oklch(0.08_0.01_240))]"
    >
      <div className="absolute inset-0 [background-image:linear-gradient(color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklch,var(--primary),transparent_92%)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="flex h-full items-center justify-center">
        <SectionIcon name={icon} className="relative size-10 text-primary/50 transition-transform duration-300 group-hover:scale-110" />
      </div>
    </div>
  );
}
