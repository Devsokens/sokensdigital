"use client";

import { str, type Section } from "../cms";
import { AddItem, Editable, ItemTools, useEditor } from "../editable";
import { FONT_DISPLAY } from "../ui";

/** Bandeau des logos partenaires sous le hero : logos clients du CMS
 * (atténués, en couleur au survol). Sur le site, un client sans logo affiche
 * son nom (contenu par défaut) ou rien ; dans l'éditeur, il affiche un
 * emplacement « Ajouter le logo », et le nom se modifie sous chaque logo.
 * Pas de libellé visible ; le titre de la section sert d'intitulé accessible. */
export function HomeTrust({ section }: { section: Section }) {
  const editor = useEditor();
  const partners = section.items.map((item) => ({ name: str(item, "name").trim(), logo: str(item, "logo_url") }));

  return (
    <section aria-label={section.title} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "oklch(var(--sd-bg-deep))" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "26px clamp(20px, 4vw, 40px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "16px clamp(36px, 5vw, 80px)" }}>
        {partners.map((partner, i) => {
          if (!editor && !partner.logo && !partner.name) return null;
          const hint = `Logo de ${partner.name || "ce client"} (fond transparent de préférence).`;
          return (
            <span key={i} style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
              <ItemTools section={section} index={i} />
              {partner.logo ? (
                <Editable section={section} path={{ scope: "item", index: i, key: "logo_url" }} kind="image" value={partner.logo} hint={hint}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="sd-logo" src={partner.logo} alt={partner.name} loading="lazy" decoding="async" style={{ display: "block", height: "48px", width: "auto", maxWidth: "170px", objectFit: "contain" }} />
                </Editable>
              ) : editor ? (
                <Editable section={section} path={{ scope: "item", index: i, key: "logo_url" }} kind="image" value="" hint={hint}>
                  <span style={{ height: "48px", padding: "0 18px", borderRadius: "10px", border: "1.5px dashed oklch(var(--sd-primary) / 0.5)", background: "oklch(var(--sd-primary) / 0.05)", color: "oklch(var(--sd-primary-hi))", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13.5px", fontWeight: 500 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="9" cy="10" r="2" />
                      <path d="m21 16-5-5-9 9" />
                    </svg>
                    Ajouter le logo
                  </span>
                </Editable>
              ) : (
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "21px", letterSpacing: "0.06em", color: "oklch(var(--sd-fg-logo))" }}>{partner.name}</span>
              )}
              {editor && (
                <Editable section={section} path={{ scope: "item", index: i, key: "name" }} value={partner.name} hint="Nom du client, lu par les lecteurs d'écran à la place du logo.">
                  <span style={{ fontSize: "12px", color: "oklch(var(--sd-fg-4))" }}>{partner.name || "Nommer ce client"}</span>
                </Editable>
              )}
            </span>
          );
        })}
        <AddItem section={section} template={{ name: "", logo_url: "" }} label="Ajouter un logo" />
      </div>
    </section>
  );
}
