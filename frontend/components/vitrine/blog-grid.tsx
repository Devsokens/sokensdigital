"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowIcon, FONT_DISPLAY } from "./ui";
import type { VitrinePost } from "./blog-data";

/* Visuels abstraits des cartes, en alternance (la maquette n'utilise pas
 * les images de couverture). */
const ARTS = [
  "radial-gradient(circle at 30% 30%, oklch(var(--sd-primary) / 0.55), transparent 55%), radial-gradient(circle at 75% 70%, oklch(var(--sd-accent-hi) / 0.4), transparent 55%), oklch(var(--sd-panel-deep))",
  "radial-gradient(circle at 70% 30%, oklch(var(--sd-teal) / 0.45), transparent 55%), radial-gradient(circle at 25% 75%, oklch(var(--sd-primary) / 0.4), transparent 55%), oklch(var(--sd-panel-deep))",
  "radial-gradient(circle at 50% 20%, oklch(var(--sd-accent-hi) / 0.5), transparent 55%), radial-gradient(circle at 60% 85%, oklch(var(--sd-teal) / 0.3), transparent 55%), oklch(var(--sd-panel-deep))",
];

/** Articles affichés au départ, puis à chaque clic sur « Voir plus d'articles ». */
const PAGE_SIZE = 3;

export function BlogGrid({ posts }: { posts: VitrinePost[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  return (
    <>
      <div className="sd-rv sd-hscroll" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: "20px" }}>
        {posts.slice(0, visible).map((post, i) => (
          <Link key={post.href} className="sd-spot sd-arrow-link" href={post.href} style={{ borderRadius: "24px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-card))", display: "flex", flexDirection: "column", color: "oklch(var(--sd-fg))" }}>
            <div aria-hidden="true" style={{ height: "190px", position: "relative", overflow: "hidden", background: "oklch(var(--sd-panel-deep))" }}>
              <div className="sd-zoom" style={{ position: "absolute", inset: "0", background: ARTS[i % ARTS.length] }} />
              <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "16px 16px", WebkitMaskImage: "linear-gradient(180deg, #000, transparent)", maskImage: "linear-gradient(180deg, #000, transparent)" }} />
            </div>
            <div style={{ padding: "24px 26px 28px", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", fontSize: "13px", color: "oklch(var(--sd-fg-4))" }}>
                <span>{post.date}</span>
              </div>
              <h3 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "21px", lineHeight: 1.25, letterSpacing: "-0.015em" }}>{post.title}</h3>
              <p style={{ margin: "0", fontSize: "15px", color: "oklch(var(--sd-fg-3))" }}>{post.excerpt}</p>
              <span style={{ marginTop: "auto", paddingTop: "6px", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14.5px", fontWeight: 500, color: "oklch(var(--sd-primary-hi))" }}>
                Lire l&apos;article
                <ArrowIcon size={15} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {visible < posts.length && (
        <div className="sd-rv" style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
          <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="sd-ghost sd-arrow-link" style={{ cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "10px", height: "50px", padding: "0 24px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "oklch(var(--sd-fg))", fontWeight: 500, fontSize: "15.5px" }}>
            Voir plus d&apos;articles
            <ArrowIcon size={17} />
          </button>
        </div>
      )}
    </>
  );
}
