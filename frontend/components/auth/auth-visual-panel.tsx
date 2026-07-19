"use client";

import { motion } from "motion/react";
import { HeroBackground } from "@/components/sections/hero-background";

export function AuthVisualPanel() {
  return (
    <div className="relative hidden h-full min-h-[32rem] overflow-hidden rounded-2xl bg-black lg:block">
      {/* large porthole circle, bleeding off the top/right edges */}
      <div className="absolute top-[-15%] right-[-20%] size-[130%] overflow-hidden rounded-full border border-white/15">
        <HeroBackground />
        <div className="absolute inset-0 rounded-full shadow-[inset_0_0_120px_40px_rgba(0,0,0,0.65)]" />
      </div>

      {/* crosshair */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 right-0 left-0 h-px bg-white/15" />
        <div className="absolute top-0 bottom-0 left-[38%] w-px bg-white/15" />
        <span className="absolute top-1/2 left-[38%] size-3 -translate-x-1/2 -translate-y-1/2 border border-primary/70" />

        <svg
          className="absolute inset-0 h-full w-full text-white/25"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <motion.path
            d="M10 100 Q 45 40 95 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.3"
            strokeDasharray="1.5 1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
      </div>

      {/* telemetry readout */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="absolute bottom-6 left-6 rounded-lg border border-white/10 bg-black/50 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-primary/80 backdrop-blur-sm"
      >
        <p>nœud&nbsp;&nbsp;&nbsp;: SKN-CORE-01</p>
        <p>statut&nbsp;&nbsp;: opérationnel</p>
        <p>chiffrement : AES-256</p>
      </motion.div>
    </div>
  );
}
