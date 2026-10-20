import { str, type Section } from "../cms";
import { AddItem, Editable, ItemTools } from "../editable";
import { FONT_DISPLAY } from "../ui";

/** Bandeau des logos partenaires sous le hero : logos clients du CMS
 * (atténués, en couleur au survol), ou leur nom quand aucun logo n'est fourni.
 * Pas de libellé visible ; le titre de la section sert d'intitulé accessible. */
export function HomeTrust({ section }: { section: Section }) {
  const partners = section.items.map((item) => ({ name: str(item, "name").trim(), logo: str(item, "logo_url") }));

  return (
    <section aria-label={section.title} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "oklch(var(--sd-bg-deep))" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "26px clamp(20px, 4vw, 40px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "16px clamp(36px, 5vw, 80px)" }}>
        {partners.map((partner, i) => (
          <span key={i} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <ItemTools section={section} index={i} />
            {partner.logo ? (
              <Editable section={section} path={{ scope: "item", index: i, key: "logo_url" }} kind="image" value={partner.logo} hint={`Logo de ${partner.name || "ce client"} (fond transparent de préférence).`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="sd-logo" src={partner.logo} alt={partner.name} loading="lazy" decoding="async" style={{ display: "block", height: "48px", width: "auto", maxWidth: "170px", objectFit: "contain" }} />
              </Editable>
            ) : (
              <Editable section={section} path={{ scope: "item", index: i, key: "name" }} value={partner.name}>
                <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "21px", letterSpacing: "0.06em", color: "oklch(var(--sd-fg-logo))" }}>{partner.name}</span>
              </Editable>
            )}
          </span>
        ))}
        <AddItem section={section} template={{ name: "Nouveau client", logo_url: "" }} label="Ajouter un client" />
      </div>
    </section>
  );
}
