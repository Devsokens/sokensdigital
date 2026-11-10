"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const HALF_FLIP_MS = 320;

type Direction = "next" | "prev";
type Phase = "idle" | "out" | "in";

/** Typographie « magazine tech » : chapeau, lettrine, intertitres à filet,
 * citations en exergue, colonnes sur grand écran. */
const PROSE = cn(
  "text-[15px] leading-[1.75] text-foreground/80 sm:text-base",
  "lg:columns-2 lg:gap-10 lg:[column-rule:1px_solid_rgb(255_255_255/0.08)]",
  "[&>*]:mb-4 [&>*]:break-inside-avoid-column",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:text-foreground",
  "[&_h2]:mt-2 [&_h2]:border-t-2 [&_h2]:border-primary [&_h2]:pt-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:[column-span:all] sm:[&_h2]:text-2xl",
  "[&_h3]:text-[11px] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.16em] [&_h3]:text-primary",
  "[&_h4]:font-semibold [&_h4]:text-foreground",
  "[&_blockquote]:my-6 [&_blockquote]:border-y [&_blockquote]:border-white/15 [&_blockquote]:py-4 [&_blockquote]:text-center [&_blockquote]:text-lg [&_blockquote]:font-semibold [&_blockquote]:italic [&_blockquote]:leading-snug [&_blockquote]:text-foreground [&_blockquote]:[column-span:all] sm:[&_blockquote]:text-xl",
  "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_li::marker]:text-primary",
  "[&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-white/10",
  "[&_code]:rounded [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs",
  "[&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/40 [&_pre]:p-4 [&_pre]:text-xs [&_pre]:[column-span:all]",
);

/** Lettrine sur le premier paragraphe du premier feuillet. */
const DROP_CAP =
  "[&>p:first-of-type]:first-letter:float-left [&>p:first-of-type]:first-letter:mr-2 [&>p:first-of-type]:first-letter:mt-1 [&>p:first-of-type]:first-letter:text-6xl [&>p:first-of-type]:first-letter:font-bold [&>p:first-of-type]:first-letter:leading-[0.8] [&>p:first-of-type]:first-letter:text-primary";

/** Coupe le HTML interne d'un paragraphe en morceaux de quelques phrases,
 * uniquement entre deux phrases et jamais dans un lien. Les balises de mise
 * en forme ouvertes (gras, italique…) sont refermées puis rouvertes de part
 * et d'autre de la coupure, pour garder un balisage valide. */
function splitParagraphHtml(inner: string, target = 150): string[] {
  const parts: string[] = [];
  const stack: { name: string; open: string }[] = [];
  let current = "";
  let textLen = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "<") {
      const close = inner.indexOf(">", i);
      if (close === -1) { current += inner.slice(i); break; }
      const tag = inner.slice(i, close + 1);
      const name = (tag.match(/^<\/?\s*([a-z0-9]+)/i)?.[1] ?? "").toLowerCase();
      if (tag.startsWith("</")) {
        const idx = stack.map((t) => t.name).lastIndexOf(name);
        if (idx !== -1) stack.splice(idx, 1);
      } else if (!tag.endsWith("/>") && name !== "br" && name !== "img") {
        stack.push({ name, open: tag });
      }
      current += tag;
      i = close;
      continue;
    }
    current += ch;
    textLen++;
    const inLink = stack.some((t) => t.name === "a");
    if (!inLink && textLen >= target && /[.!?…]/.test(ch) && /\s/.test(inner[i + 1] ?? "")) {
      const closing = [...stack].reverse().map((t) => `</${t.name}>`).join("");
      parts.push((current + closing).trim());
      current = stack.map((t) => t.open).join("");
      textLen = 0;
    }
  }
  if (current.replace(/<[^>]+>/g, "").trim()) parts.push(current.trim());
  return parts;
}

/** Blocs de premier niveau du HTML ; les longs paragraphes sont recoupés
 * pour que les feuillets se remplissent sans laisser de grands blancs. */
function splitBlocks(html: string): string[] {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const out: string[] = [];
  for (const el of Array.from(doc.body.firstElementChild?.children ?? []) as HTMLElement[]) {
    if (el.tagName === "P" && (el.textContent ?? "").length > 220) {
      for (const part of splitParagraphHtml(el.innerHTML)) out.push(`<p>${part}</p>`);
    } else {
      out.push(el.outerHTML);
    }
  }
  return out;
}

/** Remplit chaque feuillet jusqu'à la hauteur disponible, mesurée dans un
 * conteneur invisible de même largeur et même typographie. */
function paginateToHeight(blocks: string[], measurer: HTMLDivElement, firstPageHeight: number, pageHeight: number): string[] {
  const pages: string[] = [];
  let current: string[] = [];
  measurer.innerHTML = "";
  const limit = () => (pages.length === 0 ? firstPageHeight : pageHeight);
  for (const block of blocks) {
    measurer.insertAdjacentHTML("beforeend", block);
    if (current.length > 0 && measurer.scrollHeight > limit()) {
      pages.push(current.join(""));
      current = [];
      measurer.innerHTML = block;
    }
    current.push(block);
  }
  if (current.length > 0) pages.push(current.join(""));
  measurer.innerHTML = "";
  return pages;
}

/** Corps d'article mis en page comme un magazine tech, feuilleté page par
 * page (rotation 3D autour de la reliure) au lieu d'un long défilement.
 * Le rendu serveur contient l'article complet (référencement, lecture sans
 * JavaScript) ; le découpage en feuillets se fait au chargement. */
export function ArticleMagazine({ html, title, author, date }: { html: string; title: string; author: string; date: string }) {
  const [pages, setPages] = useState<string[]>([html]);
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [direction, setDirection] = useState<Direction>("next");
  const timers = useRef<number[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);

  const measureRef = useRef<HTMLDivElement>(null);

  // Hauteur d'un feuillet = hauteur visible de l'écran moins l'en-tête du
  // site, le bandeau, le folio et la navigation : une page se lit sans
  // défiler. Recalculé à la rotation de l'écran / au redimensionnement.
  useEffect(() => {
    const blocks = splitBlocks(html);
    function layout() {
      const measurer = measureRef.current;
      if (!measurer) return;
      const viewport = window.visualViewport?.height ?? window.innerHeight;
      const wide = window.matchMedia("(min-width: 1024px)").matches;
      // Mesure en une colonne ; sur grand écran deux colonnes doublent la place.
      const body = Math.max(260, viewport - (wide ? 300 : 270)) * (wide ? 2 : 1);
      const first = body - 70;
      const next = paginateToHeight(blocks, measurer, first, body);
      setPages(next);
      setPage((p) => Math.min(p, next.length - 1));
    }
    layout();
    let frame = 0;
    const onResize = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); cancelAnimationFrame(frame); };
  }, [html]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const pageCount = pages.length;

  function turnTo(target: number, dir: Direction) {
    if (phase !== "idle" || target < 0 || target >= pageCount || target === page) return;
    const scrollTop = () => {
      if ((rootRef.current?.getBoundingClientRect().top ?? 0) < 0) rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPage(target);
      scrollTop();
      return;
    }
    setDirection(dir);
    setPhase("out");
    timers.current.push(window.setTimeout(() => {
      setPage(target);
      setPhase("in");
      scrollTop();
      timers.current.push(window.setTimeout(() => setPhase("idle"), HALF_FLIP_MS));
    }, HALF_FLIP_MS));
  }
  const next = () => turnTo(page + 1, "next");
  const prev = () => turnTo(page - 1, "prev");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const sign = direction === "next" ? -1 : 1;
  const style: React.CSSProperties =
    phase === "out"
      ? { transform: `rotateY(${sign * 90}deg)`, transformOrigin: direction === "next" ? "left center" : "right center", transition: `transform ${HALF_FLIP_MS}ms cubic-bezier(0.55,0,0.75,0.3)` }
      : phase === "in"
        ? { animation: `${direction === "next" ? "art-page-in-next" : "art-page-in-prev"} ${HALF_FLIP_MS}ms cubic-bezier(0.2,0.7,0.3,1)` }
        : {};

  return (
    <div ref={rootRef} className="scroll-mt-24">
      <style>{`
        @keyframes art-page-in-next { from { transform: rotateY(90deg); transform-origin: right center; } to { transform: rotateY(0deg); transform-origin: right center; } }
        @keyframes art-page-in-prev { from { transform: rotateY(-90deg); transform-origin: left center; } to { transform: rotateY(0deg); transform-origin: left center; } }
      `}</style>

      <div
        className="[perspective:2200px]"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
        }}
      >
        <div
          key={`${page}-${phase === "in" ? "in" : "p"}`}
          style={style}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] [backface-visibility:hidden]"
        >
          {phase !== "idle" && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10"
              style={{ background: `linear-gradient(${direction === "next" ? "90deg" : "270deg"}, rgba(0,0,0,0.4), transparent 45%)` }}
            />
          )}
          {/* Pli de la reliure, côté gauche. */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-black/30 to-transparent" />

          {/* Bandeau du magazine */}
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground sm:px-10">
            <span className="text-primary">Soken&apos;s Digital · Tech News</span>
            <span className="hidden truncate sm:block">{title}</span>
          </div>

          <div className="px-5 py-5 sm:px-10 sm:py-7">
            {/* Conteneur de mesure invisible : même largeur qu'une colonne. */}
            <div aria-hidden className="pointer-events-none invisible absolute top-0 right-5 left-5 h-0 overflow-hidden sm:right-10 sm:left-10">
              <div ref={measureRef} className={cn(PROSE, "lg:w-[calc(50%-1.25rem)] lg:columns-1")} />
            </div>
            {page === 0 && (
              <p className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 pb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                <span className="rounded bg-primary px-2 py-0.5 font-semibold text-primary-foreground">Tech</span>
                {author && <span>Par {author}</span>}
                {date && <span>· {date}</span>}
                <span>· {pageCount} page{pageCount > 1 ? "s" : ""}</span>
              </p>
            )}
            <div
              className={cn(PROSE, page === 0 && DROP_CAP)}
              dangerouslySetInnerHTML={{ __html: pages[page] ?? "" }}
            />
          </div>

          {/* Folio */}
          <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 font-mono text-[11px] text-muted-foreground sm:px-10">
            <span>{date}</span>
            <span className="text-foreground">{page + 1} / {pageCount}</span>
          </div>
        </div>
      </div>

      {pageCount > 1 && (
        <nav aria-label="Pages de l'article" className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={prev}
            disabled={page === 0 || phase !== "idle"}
            aria-label="Page précédente"
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-30"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex gap-2">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Aller à la page ${i + 1}`}
                aria-current={i === page ? "page" : undefined}
                disabled={phase !== "idle"}
                onClick={() => turnTo(i, i > page ? "next" : "prev")}
                className={cn("h-2.5 rounded-full transition-all", i === page ? "w-7 bg-primary" : "w-2.5 bg-white/25 hover:bg-white/40")}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            disabled={page === pageCount - 1 || phase !== "idle"}
            aria-label="Page suivante"
            className="inline-flex size-11 items-center justify-center rounded-full border border-white/15 text-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-30"
          >
            <ChevronRight className="size-5" />
          </button>
        </nav>
      )}
    </div>
  );
}
