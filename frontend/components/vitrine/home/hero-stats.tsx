"use client";

import { Fragment, useEffect, useState } from "react";
import { str, type Section } from "../cms";
import { AddItem, Editable, ItemTools } from "../editable";
import { FONT_DISPLAY } from "../ui";

/** « 10+ » → 10 et « + », « 2 ans » → 2 et « ans ». Une valeur sans nombre
 * en tête s'affiche telle quelle, sans compteur. */
function parseStat(value: string) {
  const match = value.trim().match(/^(\d+)(.*)$/);
  return match ? { count: Number(match[1]), suffix: match[2] } : { count: null, suffix: value };
}

/** Bandeau de chiffres du hero (éléments du CMS) : compte de 0 à la valeur en
 * 1,8 s (easeOutCubic) après 0,9 s, pendant que le bandeau apparaît. Rendu
 * serveur avec les valeurs finales. */
export function HeroStats({ section }: { section: Section }) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    let raf = requestAnimationFrame(() => setProgress(0));
    let start: number | null = null;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / 1800);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    const timer = setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, 900);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, []);

  const eased = 1 - Math.pow(1 - progress, 3);
  const stats = section.items.map((item) => ({ value: str(item, "value"), label: str(item, "label") }));

  return (
    <>
      {stats.length > 0 && (
        <div className="sd-bw sd-stats" style={{ animationDelay: "0.95s", marginTop: "clamp(56px, 7vw, 88px)", display: "flex", flexWrap: "wrap", justifyContent: "center", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.09)", background: "oklch(var(--sd-bg) / 0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", overflow: "hidden" }}>
          {stats.map((stat, i) => {
            const { count, suffix } = parseStat(stat.value);
            return (
              <Fragment key={i}>
                {i > 0 && <div style={{ width: "1px", alignSelf: "stretch", background: "rgba(255,255,255,0.08)" }} />}
                <div className="sd-stat" style={{ position: "relative", padding: "22px clamp(28px, 4vw, 52px)", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                  <ItemTools section={section} index={i} />
                  <span className="sd-stat-value" style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(34px, 3.4vw, 46px)", lineHeight: 1.1, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>
                    <Editable section={section} path={{ scope: "item", index: i, key: "value" }} value={stat.value} hint="Commencez par un nombre pour l'effet de compteur : « 10+ », « 2 ans ».">
                      {count !== null && Math.round(count * eased)}
                      {suffix}
                    </Editable>
                  </span>
                  <span className="sd-stat-label" style={{ fontSize: "14px", color: "oklch(var(--sd-fg-3))" }}>
                    <Editable section={section} path={{ scope: "item", index: i, key: "label" }} value={stat.label}>
                      {stat.label}
                    </Editable>
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
      <AddItem section={section} template={{ value: "0+", label: "Nouveau chiffre" }} label="Ajouter un chiffre" style={{ marginTop: "16px" }} />
    </>
  );
}
