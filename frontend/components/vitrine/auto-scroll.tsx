"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { useEditor } from "./editable";

/** Temps passé sur chaque carte avant de passer à la suivante. */
const INTERVAL = 4500;
/** Pause après un geste de l'utilisateur, avant que le défilement reprenne. */
const RESUME_AFTER = 8000;

/** Liste de cartes en défilement horizontal (.sd-hscroll, sur mobile) qui
 * avance seule d'une carte à intervalles réguliers, puis revient au début.
 * Elle se met en pause quand l'utilisateur la touche, la survole à la souris
 * ou y navigue au clavier, et ne bouge pas hors de l'écran, avec « réduire les
 * animations » ni dans l'éditeur. Sur desktop la liste ne déborde pas : rien
 * ne défile. */
export function AutoScroll({ className, style, children }: { className?: string; style?: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const editor = useEditor();

  useEffect(() => {
    const el = ref.current;
    if (!el || editor || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let visible = false;
    let hovered = false;
    let nextAt = Infinity;
    const wait = (ms: number) => {
      nextAt = Date.now() + ms;
    };

    function advance(list: HTMLDivElement) {
      const max = list.scrollWidth - list.clientWidth;
      if (max <= 4) return;
      if (list.scrollLeft >= max - 4) {
        list.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      // Première carte dont le bord gauche dépasse la marge d'accroche (scroll-padding).
      const origin = list.getBoundingClientRect().left + (parseFloat(getComputedStyle(list).scrollPaddingLeft) || 0);
      const next = Array.from(list.children).find((card) => card.getBoundingClientRect().left - origin > 8);
      if (next) list.scrollTo({ left: Math.min(max, list.scrollLeft + next.getBoundingClientRect().left - origin), behavior: "smooth" });
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) wait(INTERVAL);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);

    // Le défilement programmé déclenche aussi « scroll » : on écoute donc les gestes, pas le défilement.
    const onGesture = () => wait(RESUME_AFTER);
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovered = true;
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      hovered = false;
      wait(INTERVAL);
    };
    const gestures = ["pointerdown", "touchstart", "wheel", "focusin"] as const;
    gestures.forEach((type) => el.addEventListener(type, onGesture, { passive: true }));
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);

    const timer = window.setInterval(() => {
      if (!visible || hovered || document.hidden || Date.now() < nextAt) return;
      advance(el);
      wait(INTERVAL);
    }, 250);

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      gestures.forEach((type) => el.removeEventListener(type, onGesture));
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [editor]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
