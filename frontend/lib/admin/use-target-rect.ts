"use client";

import { useEffect, useState } from "react";

// Some tour targets mount late (data still loading, sheet not yet rendered),
// so a single measurement on effect-run can miss them — retry with backoff
// for a couple of seconds before giving up for this session.
const RETRY_DELAYS_MS = [100, 300, 600, 1000, 1600];

export function useTargetRect(id: string | undefined) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function measure() {
      const el = id ? document.querySelector(`[data-tour="${id}"]`) : null;
      if (!cancelled) setRect(el ? el.getBoundingClientRect() : null);
      return !!el;
    }

    const found = measure();
    if (id && !found) {
      for (const delay of RETRY_DELAYS_MS) timeouts.push(setTimeout(measure, delay));
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      timeouts.forEach(clearTimeout);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [id]);

  return rect;
}
