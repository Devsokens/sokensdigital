import Link from "next/link";
import type { PageSection } from "@/lib/api/types";
import { AnimatedTitle, Title, frenchSpacing, resolveSection, type Section } from "./cms";
import * as D from "./defaults";
import { Editable, EditableSection, ManagedElsewhere } from "./editable";
import { ArrowIcon, Breadcrumb, FONT_DISPLAY, FONT_DISPLAY_SYS, HEADER_HEIGHT, underHeader } from "./ui";
import type { VitrinePost } from "./blog-data";
import { BlogGrid } from "./blog-grid";

/* Page Blog : article à la une (réseau animé), grille des articles suivants
 * (blog du CMS) et appel à l'action. Partagée par le site public et l'éditeur. */
export function BlogView({ sections, featured, posts }: { sections: PageSection[]; featured: VitrinePost; posts: VitrinePost[] }) {
  const hero = resolveSection(sections, "blog_hero", D.BLOG_HERO);
  const cta = resolveSection(sections, "blog_cta", D.BLOG_CTA);
  return (
    <>
      {hero && (
        <EditableSection section={hero} name="Hero">
          <BlogHero section={hero} />
        </EditableSection>
      )}
      <section style={{ padding: "0 0 clamp(88px, 10vw, 136px)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", display: "flex", flexDirection: "column", gap: "20px" }}>
          <ManagedElsewhere label="Articles : onglet « Blog » (liste des articles ci-dessous)">
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <FeaturedPost post={featured} />
              {posts.length > 0 && <BlogGrid posts={posts} />}
            </div>
          </ManagedElsewhere>
        </div>
      </section>
      {cta && (
        <EditableSection section={cta} name="Appel à l'action">
          <BlogCta section={cta} />
        </EditableSection>
      )}
    </>
  );
}

function BlogHero({ section }: { section: Section }) {
  return (
      <section style={{ position: "relative", overflow: "hidden", ...underHeader("clamp(72px, 9vw, 120px)", "clamp(48px, 6vw, 64px)") }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
          <div className="sd-aurora sd-au1" style={{ width: "560px", height: "560px", left: "-100px", top: `${-300 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-1))", opacity: 0.3 }} />
          <div className="sd-aurora sd-au2" style={{ width: "520px", height: "520px", right: "10%", top: `${-220 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-2))", opacity: 0.22 }} />
          <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "24px 24px", WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 40% 0%, #000 10%, transparent 75%)", maskImage: "radial-gradient(ellipse 60% 70% at 40% 0%, #000 10%, transparent 75%)" }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
          <Breadcrumb current="Blog" />
          <h1 style={{ margin: "28px 0 0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(46px, 7vw, 96px)", lineHeight: 0.98, letterSpacing: "-0.045em" }}>
            <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title} hint="La partie entre *astérisques* s'affiche en dégradé.">
              <AnimatedTitle title={section.title} start={0.1} step={0.12} />
            </Editable>
          </h1>
          <p className="sd-bw" style={{ animationDelay: "0.36s", margin: "26px 0 0", maxWidth: "600px", fontSize: "clamp(17px, 1.5vw, 19px)", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
            <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
              {frenchSpacing(section.subtitle)}
            </Editable>
          </p>
        </div>
      </section>
  );
}

function FeaturedPost({ post: featured }: { post: VitrinePost }) {
  return (
          <Link className="sd-spot sd-beam sd-arrow-link sd-rv" href={featured.href} style={{ borderRadius: "28px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-card))", display: "flex", flexWrap: "wrap", color: "oklch(var(--sd-fg))" }}>
            <div aria-hidden="true" style={{ flex: "1 1 520px", minWidth: "0", minHeight: "400px", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "oklch(var(--sd-panel-deep))" }}>
              <div className="sd-orb" style={{ position: "absolute", width: "420px", height: "420px", borderRadius: "50%", background: "conic-gradient(from 0deg, oklch(var(--sd-primary) / 0), oklch(var(--sd-primary) / 0.42), oklch(var(--sd-accent-hi) / 0.34), oklch(var(--sd-teal) / 0.28), oklch(var(--sd-primary) / 0))", filter: "blur(50px)" }} />
              <svg className="sd-zoom" width="420" height="300" viewBox="0 0 420 300" fill="none" style={{ position: "relative", maxWidth: "92%", height: "auto" }}>
                <g stroke="oklch(var(--sd-primary-hi) / 0.55)" strokeWidth="1.2">
                  <path className="sd-flow" d="M60 80 L170 60" />
                  <path className="sd-flow" d="M60 80 L170 150" />
                  <path className="sd-flow" d="M60 150 L170 60" />
                  <path className="sd-flow" d="M60 150 L170 150" />
                  <path className="sd-flow" d="M60 150 L170 240" />
                  <path className="sd-flow" d="M60 220 L170 150" />
                  <path className="sd-flow" d="M60 220 L170 240" />
                  <path className="sd-flow" d="M170 60 L280 100" />
                  <path className="sd-flow" d="M170 150 L280 100" />
                  <path className="sd-flow" d="M170 150 L280 200" />
                  <path className="sd-flow" d="M170 240 L280 200" />
                  <path className="sd-flow" d="M170 60 L280 200" />
                  <path className="sd-flow" d="M280 100 L370 150" />
                  <path className="sd-flow" d="M280 200 L370 150" />
                </g>
                <g fill="oklch(var(--sd-bg))" stroke="oklch(var(--sd-primary-hi))" strokeWidth="1.5">
                  <circle className="sd-node" cx="60" cy="80" r="9" />
                  <circle className="sd-node" cx="60" cy="150" r="9" style={{ animationDelay: "0.4s" }} />
                  <circle className="sd-node" cx="60" cy="220" r="9" style={{ animationDelay: "0.8s" }} />
                  <circle className="sd-node" cx="170" cy="60" r="10" style={{ animationDelay: "1.2s" }} />
                  <circle className="sd-node" cx="170" cy="150" r="10" style={{ animationDelay: "1.6s" }} />
                  <circle className="sd-node" cx="170" cy="240" r="10" style={{ animationDelay: "2s" }} />
                  <circle className="sd-node" cx="280" cy="100" r="10" style={{ animationDelay: "2.4s" }} />
                  <circle className="sd-node" cx="280" cy="200" r="10" style={{ animationDelay: "2.8s" }} />
                </g>
                <circle cx="370" cy="150" r="22" fill="url(#ng)" />
                <path d="M370 139l2.6 7.4 7.4 2.6-7.4 2.6-2.6 7.4-2.6-7.4-7.4-2.6 7.4-2.6z" fill="oklch(var(--sd-on-mark))" />
                <defs>
                  <linearGradient id="ng" x1="348" y1="128" x2="392" y2="172" gradientUnits="userSpaceOnUse">
                    <stop stopColor="oklch(var(--sd-primary))" />
                    <stop offset="1" stopColor="oklch(var(--sd-accent))" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div style={{ flex: "1 1 440px", minWidth: "0", padding: "clamp(28px, 4vw, 52px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "18px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", fontSize: "13.5px", color: "oklch(var(--sd-fg-3))" }}>
                <span>{featured.date}</span>
                <span aria-hidden="true">·</span>
                <span>À la une</span>
              </div>
              <h2 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(28px, 3vw, 40px)", lineHeight: 1.12, letterSpacing: "-0.03em", textWrap: "balance" }}>{featured.title}</h2>
              <p style={{ margin: "0", fontSize: "16.5px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>{featured.excerpt}</p>
              <span style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "15.5px", fontWeight: 500, color: "oklch(var(--sd-primary-hi))" }}>
                Lire l&apos;article
                <ArrowIcon size={16} />
              </span>
            </div>
          </Link>
  );
}

function BlogCta({ section }: { section: Section }) {
  return (
      <section style={{ padding: "0 0 clamp(88px, 10vw, 136px)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
          <div className="sd-beam sd-rv" style={{ position: "relative", overflow: "hidden", borderRadius: "30px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-surface))", padding: "clamp(48px, 7vw, 80px) clamp(24px, 5vw, 72px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "32px" }}>
            <div aria-hidden="true" className="sd-aurora sd-au1" style={{ width: "460px", height: "460px", right: "-120px", top: "-260px", background: "oklch(var(--sd-glow-2))", opacity: 0.32 }} />
            <div style={{ position: "relative", zIndex: 1, flex: "1 1 460px" }}>
              <h2 style={{ margin: "0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(30px, 3.8vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.035em", textWrap: "balance" }}>
                <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
                  <Title title={section.title} />
                </Editable>
              </h2>
              <p style={{ margin: "14px 0 0", maxWidth: "520px", fontSize: "17px", color: "oklch(var(--sd-fg-3))" }}>
                <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
                  {frenchSpacing(section.subtitle)}
                </Editable>
              </p>
            </div>
            <Link className="sd-shimmer sd-arrow-link" href={section.ctaLink} style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center", gap: "10px", height: "56px", padding: "0 28px", borderRadius: "12px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontWeight: 600, fontSize: "16.5px" }}>
              <Editable section={section} path={{ scope: "field", field: "cta" }} kind="link" value={{ label: section.ctaLabel, href: section.ctaLink }}>
                {section.ctaLabel}
              </Editable>
              <ArrowIcon size={18} />
            </Link>
          </div>
        </div>
      </section>
  );
}
