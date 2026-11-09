import Link from "next/link";
import { Title, frenchSpacing, type Section } from "../cms";
import { Editable, ManagedElsewhere } from "../editable";
import { CallButton } from "../call-button";
import { ArrowIcon, Eyebrow, FONT_DISPLAY, FONT_DISPLAY_SYS } from "../ui";
import type { VitrinePost } from "../blog-data";
import { CoverImage } from "../cover-image";

/** « Actualités & conseils » : le dernier article publié du blog. */
export function HomeBlog({ section, post }: { section: Section; post: VitrinePost }) {
  return (
    <section id="blog" style={{ padding: "clamp(88px, 10vw, 136px) 0 0" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div className="sd-rv" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "20px 48px", marginBottom: "40px" }}>
          <div style={{ maxWidth: "700px" }}>
            <Eyebrow>
              <Editable section={section} path={{ scope: "field", field: "kicker" }} value={section.kicker}>
                {section.kicker}
              </Editable>
            </Eyebrow>
            <h2 style={{ margin: "16px 0 0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(36px, 4.6vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.035em" }}>
              <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
                <Title title={section.title} />
              </Editable>
            </h2>
          </div>
          {section.ctaLabel && (
            <Link className="sd-arrow-link" href={section.ctaLink} style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px", fontSize: "15.5px", fontWeight: 500, color: "oklch(var(--sd-fg))" }}>
              <Editable section={section} path={{ scope: "field", field: "cta" }} kind="link" value={{ label: section.ctaLabel, href: section.ctaLink }}>
                {section.ctaLabel}
              </Editable>
              <ArrowIcon size={17} />
            </Link>
          )}
        </div>
        <ManagedElsewhere label="Article : le dernier publié dans l'onglet « Blog »">
        <Link className="sd-spot sd-arrow-link sd-rv" href={post.href} style={{ borderRadius: "24px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-card))", display: "flex", flexWrap: "wrap", color: "oklch(var(--sd-fg))" }}>
          <div aria-hidden="true" style={{ flex: "1 1 380px", minHeight: "280px", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "oklch(var(--sd-panel-deep))" }}>
            <div className="sd-orb" style={{ position: "absolute", width: "340px", height: "340px", borderRadius: "50%", background: "conic-gradient(from 0deg, oklch(var(--sd-primary) / 0.0), oklch(var(--sd-primary) / 0.45), oklch(var(--sd-accent-hi) / 0.35), oklch(var(--sd-teal) / 0.3), oklch(var(--sd-primary) / 0.0))", filter: "blur(40px)" }} />
            <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "18px 18px", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 20%, transparent 70%)", maskImage: "radial-gradient(circle at 50% 50%, #000 20%, transparent 70%)" }} />
            <span className="sd-zoom" style={{ position: "relative", width: "88px", height: "88px", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.18)", background: "oklch(var(--sd-bg) / 0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", color: "oklch(var(--sd-fg))" }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
                <path d="M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
              </svg>
            </span>
            <CoverImage src={post.coverImage} />
          </div>
          <div style={{ flex: "1 1 420px", minWidth: "0", padding: "clamp(28px, 4vw, 48px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", fontSize: "13.5px", color: "oklch(var(--sd-fg-3))" }}>
              <span>{post.date}</span>
            </div>
            <h3 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(24px, 2.4vw, 32px)", lineHeight: 1.18, letterSpacing: "-0.025em", textWrap: "balance" }}>{post.title}</h3>
            <p style={{ margin: "0", fontSize: "16px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>{post.excerpt}</p>
            <span style={{ marginTop: "4px", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 500, color: "oklch(var(--sd-primary-hi))" }}>
              Lire l&apos;article
              <ArrowIcon size={16} />
            </span>
          </div>
        </Link>
        </ManagedElsewhere>
      </div>
    </section>
  );
}

/** Appel à l'action final : bouton principal et numéro de téléphone (paramètres du site). */
export function HomeCta({ section, phone }: { section: Section; phone: string }) {
  return (
    <section style={{ padding: "clamp(88px, 10vw, 136px) 0" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div className="sd-beam sd-rv" style={{ position: "relative", overflow: "hidden", borderRadius: "30px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-surface))", padding: "clamp(56px, 8vw, 104px) clamp(24px, 5vw, 72px)", textAlign: "center" }}>
          <div aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
            <div className="sd-aurora sd-au1" style={{ width: "460px", height: "460px", left: "-80px", bottom: "-260px", background: "oklch(var(--sd-glow-1))", opacity: 0.4 }} />
            <div className="sd-aurora sd-au2" style={{ width: "420px", height: "420px", right: "-60px", top: "-240px", background: "oklch(var(--sd-glow-2))", opacity: 0.32 }} />
            <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "22px 22px", WebkitMaskImage: "radial-gradient(ellipse 50% 60% at 50% 50%, #000 10%, transparent 75%)", maskImage: "radial-gradient(ellipse 50% 60% at 50% 50%, #000 10%, transparent 75%)" }} />
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h2 style={{ margin: "0", maxWidth: "820px", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(36px, 5vw, 68px)", lineHeight: 1.02, letterSpacing: "-0.038em", textWrap: "balance" }}>
              <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
                <Title title={section.title} />
              </Editable>
            </h2>
            <p style={{ margin: "22px 0 0", maxWidth: "540px", fontSize: "17.5px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
              <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
                {frenchSpacing(section.subtitle)}
              </Editable>
            </p>
            <div className="sd-cta-row" style={{ marginTop: "38px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
              <Link className="sd-shimmer sd-arrow-link" href={section.ctaLink} style={{ display: "inline-flex", alignItems: "center", gap: "10px", height: "56px", padding: "0 28px", borderRadius: "12px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontWeight: 600, fontSize: "16.5px" }}>
                <Editable section={section} path={{ scope: "field", field: "cta" }} kind="link" value={{ label: section.ctaLabel, href: section.ctaLink }}>
                  {section.ctaLabel}
                </Editable>
                <ArrowIcon size={18} />
              </Link>
              <CallButton phone={phone} size={56} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
