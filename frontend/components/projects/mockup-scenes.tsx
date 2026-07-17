"use client";

import { motion } from "motion/react";

export type SceneVariant =
  | "chart"
  | "network"
  | "map"
  | "code"
  | "security"
  | "medical";

const BARS = [0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.45];
const CODE_LINES = [0.9, 0.55, 0.75, 0.35, 0.65, 0.85, 0.45];

export function MockupScene({ variant }: { variant: SceneVariant }) {
  switch (variant) {
    case "chart":
      return <ChartScene />;
    case "network":
      return <NetworkScene />;
    case "map":
      return <MapScene />;
    case "code":
      return <CodeScene />;
    case "security":
      return <SecurityScene />;
    case "medical":
      return <MedicalScene />;
    default:
      return null;
  }
}

function ChartScene() {
  return (
    <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
      <svg viewBox="0 0 200 60" className="mb-4 h-12 w-full text-primary/60" fill="none">
        <motion.path
          d="M0 45 L30 30 L60 38 L90 15 L120 25 L150 8 L200 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, repeat: Infinity, repeatType: "loop", repeatDelay: 0.6 }}
        />
      </svg>
      <div className="flex h-16 items-end justify-center gap-1.5 sm:h-20">
        {BARS.map((h, i) => (
          <motion.span
            key={i}
            className="w-2 rounded-t-sm bg-primary/40 sm:w-2.5"
            initial={{ height: `${h * 100}%` }}
            animate={{
              height: [`${h * 100}%`, `${Math.min(h * 140, 100)}%`, `${h * 60}%`, `${h * 100}%`],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

function NetworkScene() {
  const nodes = [
    { x: 30, y: 30 }, { x: 90, y: 15 }, { x: 150, y: 35 },
    { x: 60, y: 60 }, { x: 120, y: 65 }, { x: 170, y: 55 },
  ];
  const links = [
    [0, 1], [1, 2], [0, 3], [1, 4], [2, 4], [3, 4], [4, 5],
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <svg viewBox="0 0 200 80" className="h-full w-full max-w-sm text-primary/50" fill="none">
        {links.map(([a, b], i) => (
          <motion.line
            key={i}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke="currentColor"
            strokeWidth="1"
            initial={{ opacity: 0.15 }}
            animate={{ opacity: [0.15, 0.5, 0.15] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
        {nodes.map((n, i) => (
          <motion.circle
            key={i}
            cx={n.x} cy={n.y} r="4"
            fill="currentColor"
            initial={{ scale: 0.8, opacity: 0.6 }}
            animate={{ scale: [0.8, 1.3, 0.8], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.25 }}
          />
        ))}
      </svg>
    </div>
  );
}

function MapScene() {
  const routes = [
    "M20 55 Q70 15 130 40",
    "M40 20 Q100 60 170 30",
    "M15 35 Q90 70 180 50",
  ];
  const dots = [
    { x: 20, y: 55 }, { x: 130, y: 40 }, { x: 40, y: 20 },
    { x: 170, y: 30 }, { x: 180, y: 50 }, { x: 15, y: 35 },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <svg viewBox="0 0 200 80" className="h-full w-full max-w-sm text-primary/50" fill="none">
        {routes.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="3 3"
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: [0, 1], opacity: [0.2, 0.6, 0.2] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
          />
        ))}
        {dots.map((d, i) => (
          <motion.circle
            key={i}
            cx={d.x} cy={d.y} r="3"
            fill="currentColor"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </svg>
    </div>
  );
}

function CodeScene() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 p-7 sm:p-9">
      {CODE_LINES.map((w, i) => (
        <motion.div
          key={i}
          className="h-2 rounded-sm bg-primary/35"
          style={{ width: `${w * 100}%` }}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

function SecurityScene() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border border-primary/30"
          style={{ width: 40, height: 40 }}
          animate={{ width: [40, 140], height: [40, 140], opacity: [0.6, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
        />
      ))}
      <span className="relative flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
        <svg viewBox="0 0 24 24" fill="none" className="size-5">
          <path
            d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </span>
    </div>
  );
}

function MedicalScene() {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <svg viewBox="0 0 200 60" className="h-16 w-full max-w-sm text-primary/60" fill="none">
        <motion.path
          d="M0 30 L40 30 L52 10 L64 50 L76 30 L90 30 L100 18 L110 30 L200 30"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0.4 }}
          animate={{ pathLength: [0, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
        />
      </svg>
    </div>
  );
}
