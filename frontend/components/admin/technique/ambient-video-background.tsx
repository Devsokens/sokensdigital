"use client";

import { useEffect, useRef } from "react";

/** Looping muted video behind a module — spans the full height of the
 * content column (grows with it, via `inset-0` on a `relative isolate`
 * parent) rather than just the header band, so it reads as the page's
 * background rather than a strip. Cards sit on their own opaque white
 * background so they stay perfectly legible on top of it regardless.
 * Paused under prefers-reduced-motion instead of using CSS (no CSS-only way
 * to stop a <video>'s own playback).
 *
 * Le voile blanc au-dessus de la vidéo (`from-white/70 ... to-white/40`)
 * était nettement trop opaque en haut et en bas : ça délavait le haut/bas de
 * la vidéo en blanc, perçu comme des "bords blancs". Allégé pour que la
 * vidéo reste visible sur toute sa hauteur, tout en gardant un léger voile
 * uniforme pour la lisibilité du contenu posé dessus. */
export function AmbientVideoBackground({ src = "/assets/projects-bg.mp4" }: { src?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      videoRef.current?.pause();
    }
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="size-full object-cover opacity-70"
      >
        <source src={src} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-white/15" />
    </div>
  );
}
