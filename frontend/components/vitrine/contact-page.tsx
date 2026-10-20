import type { PageSection } from "@/lib/api/types";
import { AnimatedTitle, frenchSpacing, resolveSection, type Section } from "./cms";
import { ContactForm } from "./contact-form";
import * as D from "./defaults";
import { Editable, EditableSection } from "./editable";
import { FONT_DISPLAY_SYS, FONT_MONO, PhoneIcon, HEADER_HEIGHT, telHref, underHeader } from "./ui";

/* Page Contact : présentation de l'équipe et canaux directs à gauche,
 * formulaire « Démarrer un projet » à droite. */

const AVATARS = [
  { initials: "HO", bg: "oklch(0.199 0.018 240)" },
  { initials: "DM", bg: "oklch(0.223 0.018 240)" },
  { initials: "ES", bg: "oklch(0.251 0.018 240)" },
];

const CHANNEL_STYLE = { display: "flex", alignItems: "center", gap: "16px", padding: "14px 18px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.02)", color: "oklch(var(--sd-fg))" } as const;

function ChannelArrow() {
  return (
    <svg className="sd-arr" style={{ marginLeft: "auto", flex: "none", color: "oklch(var(--sd-fg-4))" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

/** Page Contact, partagée par le site public et l'éditeur visuel. Le
 * formulaire a sa propre section dans le CMS (titre, choix, bouton). */
export function ContactView({ sections, email, phone }: { sections: PageSection[]; email: string; phone: string }) {
  const hero = resolveSection(sections, "contact_hero", D.CONTACT_HERO) ?? resolveFallback("contact_hero", D.CONTACT_HERO);
  const form = resolveSection(sections, "contact_form", D.CONTACT_FORM) ?? resolveFallback("contact_form", D.CONTACT_FORM);
  return (
    <EditableSection section={hero} name="Contact" canHide={false}>
      <ContactContent hero={hero} form={form} email={email} phone={phone} />
    </EditableSection>
  );
}

/** La page Contact n'a pas de sens sans son contenu : une section masquée garde le texte par défaut. */
function resolveFallback(key: string, fallback: Partial<Section>) {
  return resolveSection([], key, fallback)!;
}

function ContactContent({ hero, form, email, phone }: { hero: Section; form: Section; email: string; phone: string }) {
  const teamTitle = typeof hero.extra.team_title === "string" ? hero.extra.team_title : "";
  const teamSubtitle = typeof hero.extra.team_subtitle === "string" ? hero.extra.team_subtitle : "";
  return (
    <section style={{ position: "relative", overflow: "hidden", ...underHeader("clamp(64px, 8vw, 112px)", "clamp(88px, 10vw, 136px)") }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
        <div className="sd-aurora sd-au1" style={{ width: "620px", height: "620px", left: "-160px", top: `${-260 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-1))", opacity: 0.3 }} />
        <div className="sd-aurora sd-au2" style={{ width: "560px", height: "560px", right: "-120px", top: `${200 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-2))", opacity: 0.22 }} />
        <div style={{ position: "absolute", inset: "0", backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)", backgroundSize: "64px 64px", WebkitMaskImage: "radial-gradient(ellipse 50% 60% at 25% 20%, #000 10%, transparent 75%)", maskImage: "radial-gradient(ellipse 50% 60% at 25% 20%, #000 10%, transparent 75%)" }} />
      </div>
      {/* Grille : intro et coordonnées à gauche, formulaire à droite ; sur mobile
       * intro, formulaire puis coordonnées (vitrine.css, .sd-contact-grid). */}
      <div className="sd-contact-grid" style={{ position: "relative", zIndex: 1, maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div style={{ gridArea: "intro", minWidth: "0" }}>
          <h1 style={{ margin: "0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(44px, 6vw, 84px)", lineHeight: 0.98, letterSpacing: "-0.045em" }}>
            <Editable section={hero} path={{ scope: "field", field: "title" }} value={hero.title} hint="La partie entre *astérisques* s'affiche en dégradé, sur sa propre ligne.">
              <AnimatedTitle title={hero.title} start={0.05} step={0.1} highlightDelay={0.28} breakLine />
            </Editable>
          </h1>
          <p className="sd-bw" style={{ animationDelay: "0.42s", margin: "24px 0 0", maxWidth: "480px", fontSize: "clamp(17px, 1.5vw, 19px)", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
            <Editable section={hero} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={hero.subtitle}>
              {frenchSpacing(hero.subtitle)}
            </Editable>
          </p>
        </div>
        <div className="sd-contact-coords" style={{ gridArea: "coords", minWidth: "0" }}>
          <div className="sd-bw" style={{ animationDelay: "0.54s", marginTop: "32px", display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex" }}>
              <span className="sd-ring-spin" style={{ width: "46px", height: "46px", borderRadius: "50%", padding: "2px", display: "flex" }}>
                <span style={{ flex: 1, borderRadius: "50%", background: "oklch(0.173 0.016 240)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600 }}>JM</span>
              </span>
              {AVATARS.map((avatar) => (
                <span key={avatar.initials} style={{ width: "46px", height: "46px", marginLeft: "-12px", borderRadius: "50%", border: "2px solid oklch(var(--sd-bg))", background: avatar.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 600 }}>{avatar.initials}</span>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "15px", fontWeight: 500, color: "oklch(var(--sd-fg))" }}>
                <Editable section={hero} path={{ scope: "extra", key: "team_title" }} value={teamTitle}>
                  {teamTitle}
                </Editable>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "13.5px", color: "oklch(var(--sd-fg-3))" }}>
                <span className="sd-pulse" style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#3DD68C" }} />
                <Editable section={hero} path={{ scope: "extra", key: "team_subtitle" }} value={teamSubtitle}>
                  {teamSubtitle}
                </Editable>
              </span>
            </div>
          </div>
          <div className="sd-bw" style={{ animationDelay: "0.66s", marginTop: "40px", display: "flex", flexDirection: "column", gap: "10px", maxWidth: "480px" }}>
            <a className="sd-channel sd-arrow-link" href={`mailto:${email}`} style={CHANNEL_STYLE}>
              <span style={{ width: "42px", height: "42px", flex: "none", borderRadius: "11px", background: "oklch(var(--sd-primary) / 0.1)", color: "oklch(var(--sd-primary-hi))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                <span style={{ fontSize: "13px", color: "oklch(var(--sd-fg-4))" }}>Email</span>
                <span style={{ fontSize: "15.5px", fontWeight: 500 }}>
                  <Editable path={{ scope: "settings", key: "contact_email" }} value={email}>
                    {email}
                  </Editable>
                </span>
              </span>
              <ChannelArrow />
            </a>
            <a className="sd-channel sd-arrow-link" href={telHref(phone)} style={CHANNEL_STYLE}>
              <span style={{ width: "42px", height: "42px", flex: "none", borderRadius: "11px", background: "rgba(61,214,140,0.1)", color: "#3DD68C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PhoneIcon size={19} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                <span style={{ fontSize: "13px", color: "oklch(var(--sd-fg-4))" }}>Téléphone</span>
                <span style={{ fontSize: "15.5px", fontWeight: 500 }}>
                  <Editable path={{ scope: "settings", key: "contact_phone" }} value={phone}>
                    {phone}
                  </Editable>
                </span>
              </span>
              <ChannelArrow />
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 18px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.02)" }}>
              <span aria-hidden="true" style={{ position: "relative", width: "42px", height: "42px", flex: "none", borderRadius: "11px", background: "oklch(var(--sd-primary) / 0.06)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <span className="sd-ping" style={{ position: "absolute", width: "34px", height: "34px", borderRadius: "50%", border: "1px solid oklch(var(--sd-primary) / 0.7)" }} />
                <span className="sd-ping" style={{ position: "absolute", width: "34px", height: "34px", borderRadius: "50%", border: "1px solid oklch(var(--sd-primary) / 0.7)", animationDelay: "1.2s" }} />
                <span style={{ position: "relative", width: "9px", height: "9px", borderRadius: "50%", background: "oklch(var(--sd-primary))", boxShadow: "0 0 12px oklch(var(--sd-primary))" }} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                <span style={{ fontSize: "13px", color: "oklch(var(--sd-fg-4))" }}>Localisation</span>
                <span style={{ fontSize: "15.5px", fontWeight: 500 }}>Libreville, Gabon</span>
              </span>
              <span style={{ marginLeft: "auto", fontFamily: FONT_MONO, fontSize: "12px", color: "oklch(var(--sd-fg-4))" }}>0°23′N · 9°27′E</span>
            </div>
          </div>
        </div>
        <ContactForm section={form} />
      </div>
    </section>
  );
}
