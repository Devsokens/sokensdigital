"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon, FONT_DISPLAY, FONT_MONO } from "./ui";
import type { VitrinePost } from "./blog-data";
import { CoverImage } from "./cover-image";

/* Visuels abstraits, en alternance — repli quand un article n'a pas
 * d'image de couverture. */
const ARTS = [
  "radial-gradient(circle at 30% 30%, oklch(var(--sd-primary) / 0.55), transparent 55%), radial-gradient(circle at 75% 70%, oklch(var(--sd-accent-hi) / 0.4), transparent 55%), oklch(var(--sd-panel-deep))",
  "radial-gradient(circle at 70% 30%, oklch(var(--sd-teal) / 0.45), transparent 55%), radial-gradient(circle at 25% 75%, oklch(var(--sd-primary) / 0.4), transparent 55%), oklch(var(--sd-panel-deep))",
  "radial-gradient(circle at 50% 20%, oklch(var(--sd-accent-hi) / 0.5), transparent 55%), radial-gradient(circle at 60% 85%, oklch(var(--sd-teal) / 0.3), transparent 55%), oklch(var(--sd-panel-deep))",
];

/** Articles par page du « magazine » : un article principal + trois brèves. */
const PAGE_SIZE = 4;
/** Durée d'une demi-rotation de page (sortie puis entrée). */
const HALF_FLIP_MS = 320;

type Direction = "next" | "prev";
type Phase = "idle" | "out" | "in";

function Visual({ post, index, height }: { post: VitrinePost; index: number; height: string }) {
  return (
    <div aria-hidden="true" style={{ height, position: "relative", overflow: "hidden", borderRadius: "18px", background: "oklch(var(--sd-panel-deep))" }}>
      <div className="sd-zoom" style={{ position: "absolute", inset: "0", background: ARTS[index % ARTS.length] }} />
      <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "16px 16px", WebkitMaskImage: "linear-gradient(180deg, #000, transparent)", maskImage: "linear-gradient(180deg, #000, transparent)" }} />
      <CoverImage src={post.coverImage} />
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT_MONO, fontSize: "11.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(var(--sd-primary-hi))" }}>{children}</span>;
}

/** Page « à la une » du numéro : grand visuel, titre éditorial. */
function LeadStory({ post, index }: { post: VitrinePost; index: number }) {
  return (
    <Link href={post.href} className="sd-spot sd-arrow-link" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: "clamp(18px, 3vw, 32px)", alignItems: "center", color: "oklch(var(--sd-fg))" }}>
      <Visual post={post} index={index} height="clamp(220px, 30vw, 340px)" />
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <Kicker>Dossier · {post.date}</Kicker>
        <h3 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(26px, 3vw, 38px)", lineHeight: 1.1, letterSpacing: "-0.03em", textWrap: "balance" }}>{post.title}</h3>
        <p style={{ margin: "0", fontSize: "16px", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>{post.excerpt}</p>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 500, color: "oklch(var(--sd-primary-hi))" }}>
          Lire le dossier
          <ArrowIcon size={15} />
        </span>
      </div>
    </Link>
  );
}

/** Brève numérotée, façon sommaire de magazine. */
function Brief({ post, index, number }: { post: VitrinePost; index: number; number: number }) {
  return (
    <Link href={post.href} className="sd-arrow-link" style={{ display: "flex", flexDirection: "column", gap: "12px", color: "oklch(var(--sd-fg))", paddingTop: "18px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <Visual post={post} index={index} height="150px" />
      <div style={{ display: "flex", gap: "14px", alignItems: "baseline" }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "30px", lineHeight: 1, color: "oklch(var(--sd-primary-hi) / 0.55)" }}>{String(number).padStart(2, "0")}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
          <span style={{ fontSize: "12.5px", color: "oklch(var(--sd-fg-4))" }}>{post.date}</span>
          <h4 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "18px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{post.title}</h4>
        </div>
      </div>
    </Link>
  );
}

/** Blog en « magazine tech » : les articles sont répartis en pages qu'on
 * feuillette (rotation 3D autour de la reliure) au lieu de défiler. Boutons,
 * flèches du clavier et glissé tactile ; animation coupée si l'utilisateur
 * a demandé à réduire les mouvements. */
export function BlogGrid({ posts }: { posts: VitrinePost[] }) {
  const pageCount = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [direction, setDirection] = useState<Direction>("next");
  const touchX = useRef<number | null>(null);
  const timers = useRef<number[]>([]);
  const bookRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function turn(dir: Direction) {
    const target = dir === "next" ? page + 1 : page - 1;
    if (target >= 0 && target < pageCount) turnTo(target, dir);
  }

  const items = posts.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const [lead, ...briefs] = items;

  // Page suivante : la feuille pivote autour de sa reliure gauche, comme une
  // page de droite qu'on tourne ; page précédente : autour de la droite.
  const origin = direction === "next" ? "left center" : "right center";
  const sign = direction === "next" ? -1 : 1;
  const transform = phase === "out" ? `rotateY(${sign * 90}deg)` : "rotateY(0deg)";
  const startIn = phase === "in";

  return (
    <div ref={bookRef} className="sd-rv" style={{ scrollMarginTop: "96px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "8px 24px", padding: "0 4px 16px", borderBottom: "2px solid oklch(var(--sd-fg) / 0.85)" }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "clamp(20px, 2.4vw, 26px)", letterSpacing: "-0.02em" }}>Le Magazine</span>
        <span style={{ fontFamily: FONT_MONO, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: "oklch(var(--sd-fg-4))" }}>
          Page {page + 1} / {pageCount}
        </span>
      </div>

      <div
        style={{ perspective: "2200px", marginTop: "24px" }}
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) turn(dx < 0 ? "next" : "prev");
        }}
      >
        <div
          key={`${page}-${phase === "in" ? "in" : "page"}`}
          aria-live="polite"
          style={{
            position: "relative",
            transformOrigin: origin,
            transform,
            transition: phase === "idle" ? "none" : `transform ${HALF_FLIP_MS}ms ${phase === "out" ? "cubic-bezier(0.55, 0, 0.75, 0.3)" : "cubic-bezier(0.2, 0.7, 0.3, 1)"}`,
            animation: startIn ? `${direction === "next" ? "sd-page-in-next" : "sd-page-in-prev"} ${HALF_FLIP_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1)` : undefined,
            backfaceVisibility: "hidden",
            borderRadius: "28px",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "oklch(var(--sd-card))",
            padding: "clamp(20px, 4vw, 44px)",
            boxShadow: "0 30px 60px -30px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            gap: "clamp(24px, 4vw, 40px)",
          }}
        >
          {/* Ombre de la reliure pendant la rotation. */}
          {phase !== "idle" && (
            <div aria-hidden="true" style={{ position: "absolute", inset: "0", borderRadius: "28px", pointerEvents: "none", background: `linear-gradient(${direction === "next" ? "90deg" : "270deg"}, rgba(0,0,0,0.35), transparent 40%)` }} />
          )}
          {lead && <LeadStory post={lead} index={page * PAGE_SIZE} />}
          {briefs.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(230px, 100%), 1fr))", gap: "24px" }}>
              {briefs.map((post, i) => (
                <Brief key={post.href} post={post} index={page * PAGE_SIZE + i + 1} number={page * PAGE_SIZE + i + 2} />
              ))}
            </div>
          )}
        </div>
      </div>

      {pageCount > 1 && (
        <nav aria-label="Pages du magazine" style={{ marginTop: "22px", display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
          <PageButton label="Page précédente" disabled={page === 0 || phase !== "idle"} onClick={() => turn("prev")} flip />
          <div style={{ display: "flex", gap: "8px" }}>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Aller à la page ${i + 1}`}
                aria-current={i === page ? "page" : undefined}
                disabled={phase !== "idle"}
                onClick={() => i !== page && (i > page ? turnTo(i, "next") : turnTo(i, "prev"))}
                style={{ cursor: "pointer", width: i === page ? "26px" : "10px", height: "10px", borderRadius: "999px", border: "none", background: i === page ? "oklch(var(--sd-primary))" : "rgba(255,255,255,0.22)", transition: "width 0.25s, background 0.25s" }}
              />
            ))}
          </div>
          <PageButton label="Page suivante" disabled={page === pageCount - 1 || phase !== "idle"} onClick={() => turn("next")} />
        </nav>
      )}
      <KeyboardTurns onTurn={turn} />
    </div>
  );

  function turnTo(target: number, dir: Direction) {
    // Saut direct vers une page : une seule rotation, puis la page visée.
    if (phase !== "idle") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPage(target);
      return;
    }
    setDirection(dir);
    setPhase("out");
    timers.current.push(window.setTimeout(() => {
      setPage(target);
      setPhase("in");
      // Garde le haut du magazine visible quand une page plus courte arrive.
      if ((bookRef.current?.getBoundingClientRect().top ?? 0) < 0) bookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      timers.current.push(window.setTimeout(() => setPhase("idle"), HALF_FLIP_MS));
    }, HALF_FLIP_MS));
  }
}

function PageButton({ label, disabled, onClick, flip }: { label: string; disabled: boolean; onClick: () => void; flip?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="sd-ghost"
      style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", width: "48px", height: "48px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "oklch(var(--sd-fg))" }}
    >
      <span style={{ display: "inline-flex", transform: flip ? "rotate(180deg)" : undefined }}>
        <ArrowIcon size={18} />
      </span>
    </button>
  );
}

/** Flèches gauche/droite pour tourner les pages, sauf pendant une saisie. */
function KeyboardTurns({ onTurn }: { onTurn: (dir: Direction) => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (e.key === "ArrowRight") onTurn("next");
      if (e.key === "ArrowLeft") onTurn("prev");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onTurn]);
  return (
    <style>{`
      @keyframes sd-page-in-next { from { transform: rotateY(90deg); transform-origin: right center; } to { transform: rotateY(0deg); transform-origin: right center; } }
      @keyframes sd-page-in-prev { from { transform: rotateY(-90deg); transform-origin: left center; } to { transform: rotateY(0deg); transform-origin: left center; } }
    `}</style>
  );
}
