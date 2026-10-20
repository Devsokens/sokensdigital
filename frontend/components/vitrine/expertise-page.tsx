import Link from "next/link";
import type { PageSection } from "@/lib/api/types";
import { SectionIcon } from "@/components/dynamic-icon";
import { AnimatedTitle, Title, frenchSpacing, resolveSection, str, type Section } from "./cms";
import * as D from "./defaults";
import { AddItem, Editable, EditableSection, ItemTools } from "./editable";
import { StackEditorList } from "./stack-editor-list";
import { TechLogo, techLogo } from "./tech-logos";
import { ArrowIcon, BrandMark, Breadcrumb, Eyebrow, FONT_DISPLAY, FONT_DISPLAY_SYS, FONT_MONO, HEADER_HEIGHT, underHeader } from "./ui";

/* Page Expertise : engagements (schéma animé), méthode en 4 étapes,
 * technologies en orbite et appel à l'action — contenu des sections du CMS. */

/** Icônes de la maquette (dessin exact) ; tout autre nom vient de lucide. */
function PromiseIcon({ name, size }: { name: string; size: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "shield-check":
      return (
        <svg {...common}>
          <path d="M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "zap":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
    case "layers":
      return (
        <svg {...common}>
          <path d="M12 3 3 8l9 5 9-5z" />
          <path d="M3 13l9 5 9-5" />
          <path d="M3 17.5l9 5 9-5" />
        </svg>
      );
    default:
      return <SectionIcon name={name} className={size > 21 ? "size-[22px]" : "size-[21px]"} />;
  }
}

/** Répartit des étiquettes sur un cercle (positions en % du conteneur). */
function ring(labels: string[], startDeg: number) {
  return labels.map((label, i) => {
    const a = ((startDeg + (i * 360) / labels.length) * Math.PI) / 180;
    return { label, x: `${(50 + 50 * Math.cos(a)).toFixed(2)}%`, y: `${(50 + 50 * Math.sin(a)).toFixed(2)}%` };
  });
}

/** Pastilles du schéma : même style sobre pour toutes, sans halo. */
const NODE_BORDER = "1px solid oklch(var(--sd-primary) / 0.45)";
const NODE_BG = "oklch(0.148 0.017 240)";

/** Positions verticales des 3 engagements sur le schéma (fixées par les tracés SVG). */
const DIAGRAM_Y = ["19.05%", "50%", "80.95%"];

function ExpertiseHero({ section }: { section: Section }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", ...underHeader("clamp(72px, 9vw, 120px)", "clamp(72px, 8vw, 112px)"), borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
        <div className="sd-aurora sd-au1" style={{ width: "620px", height: "620px", left: "-120px", top: `${-280 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-1))", opacity: 0.3 }} />
        <div className="sd-aurora sd-au2" style={{ width: "520px", height: "520px", right: "6%", top: `${40 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-2))", opacity: 0.2 }} />
        <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1px)", backgroundSize: "24px 24px", WebkitMaskImage: "radial-gradient(ellipse 55% 60% at 30% 40%, #000 10%, transparent 75%)", maskImage: "radial-gradient(ellipse 55% 60% at 30% 40%, #000 10%, transparent 75%)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 1, maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <Breadcrumb current="Expertise" />
        <h1 style={{ margin: "28px 0 0", maxWidth: "1000px", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(46px, 7vw, 96px)", lineHeight: 0.98, letterSpacing: "-0.045em" }}>
          <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title} hint="La partie entre *astérisques* s'affiche en dégradé, sur sa propre ligne.">
            <AnimatedTitle title={section.title} start={0.1} step={0.08} breakLine />
          </Editable>
        </h1>
        <div style={{ marginTop: "32px", display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "32px 48px" }}>
          <p className="sd-bw" style={{ animationDelay: "0.66s", margin: "0", maxWidth: "560px", fontSize: "clamp(17px, 1.5vw, 19px)", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
            <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
              {frenchSpacing(section.subtitle)}
            </Editable>
          </p>
          <div className="sd-bw sd-btn-row" style={{ animationDelay: "0.78s", display: "flex", flexWrap: "wrap", gap: "12px" }}>
            <Link className="sd-shimmer sd-arrow-link" href={section.ctaLink} style={{ display: "inline-flex", alignItems: "center", gap: "10px", height: "54px", padding: "0 26px", borderRadius: "12px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontWeight: 600, fontSize: "16px" }}>
              <Editable section={section} path={{ scope: "field", field: "cta" }} kind="link" value={{ label: section.ctaLabel, href: section.ctaLink }}>
                {section.ctaLabel}
              </Editable>
              <ArrowIcon size={18} />
            </Link>
            {section.ctaSecondaryLabel && (
              <Link className="sd-ghost" href={section.ctaSecondaryLink} style={{ display: "inline-flex", alignItems: "center", height: "54px", padding: "0 24px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "oklch(var(--sd-fg))", fontWeight: 500, fontSize: "16px" }}>
                <Editable section={section} path={{ scope: "field", field: "ctaSecondary" }} kind="link" value={{ label: section.ctaSecondaryLabel, href: section.ctaSecondaryLink }}>
                  {section.ctaSecondaryLabel}
                </Editable>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ExpertisePromises({ section }: { section: Section }) {
  const promises = section.items.map((item, i) => ({ icon: str(item, "icon") || "shield-check", short: str(item, "short"), title: str(item, "title"), text: str(item, "description"), delay: `${(i % 3) * 2}s` }));
  return (
    <section style={{ padding: "clamp(88px, 10vw, 136px) 0", background: "oklch(var(--sd-bg-deep))", borderBottom: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "56px clamp(40px, 6vw, 96px)" }}>
        <div className="sd-rv" style={{ flex: "1 1 440px", minWidth: "0" }}>
          <Eyebrow>
            <Editable section={section} path={{ scope: "field", field: "kicker" }} value={section.kicker}>
              {section.kicker}
            </Editable>
          </Eyebrow>
          <h2 style={{ margin: "16px 0 0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(36px, 4.6vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.035em", textWrap: "balance" }}>
            <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
              <Title title={section.title} />
            </Editable>
          </h2>
          <div style={{ marginTop: "36px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {promises.map((pr, i) => (
              <div key={i} className="sd-hl" style={{ position: "relative", display: "flex", gap: "18px", padding: "20px 22px", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.015)", animationDelay: pr.delay }}>
                <ItemTools section={section} index={i} />
                <span style={{ width: "44px", height: "44px", flex: "none", borderRadius: "12px", background: "oklch(var(--sd-primary) / 0.1)", color: "oklch(var(--sd-primary-hi))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Editable section={section} path={{ scope: "item", index: i, key: "icon" }} kind="icon" value={pr.icon}>
                    <PromiseIcon name={pr.icon} size={21} />
                  </Editable>
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <h3 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "21px", lineHeight: 1.25, letterSpacing: "-0.015em" }}>
                    <Editable section={section} path={{ scope: "item", index: i, key: "title" }} value={pr.title}>
                      {pr.title}
                    </Editable>
                  </h3>
                  <p style={{ margin: "0", fontSize: "15.5px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
                    <Editable section={section} path={{ scope: "item", index: i, key: "description" }} kind="textarea" value={pr.text}>
                      {frenchSpacing(pr.text)}
                    </Editable>
                  </p>
                </div>
              </div>
            ))}
            <AddItem section={section} template={{ icon: "sparkles", short: "Nouveau", title: "Nouvel engagement", description: "Description de l'engagement." }} label="Ajouter un engagement" />
          </div>
        </div>
        <div aria-hidden="true" className="sd-rv" style={{ flex: "1 1 440px", minWidth: "0", display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: "min(520px, 100%)", aspectRatio: "520 / 420" }}>
            <svg viewBox="0 0 520 420" fill="none" style={{ position: "absolute", inset: "0", width: "100%", height: "100%", overflow: "visible" }}>
              <g stroke="rgba(255,255,255,0.1)" strokeWidth="2">
                <path d="M70 80 C 170 80, 160 210, 260 210" />
                <path d="M70 210 L 260 210" />
                <path d="M70 340 C 170 340, 160 210, 260 210" />
                <path d="M260 210 L 450 210" />
              </g>
              <g stroke="oklch(var(--sd-primary-hi))" strokeWidth="2.5" strokeLinecap="round">
                <path className="sd-bflow" pathLength="100" strokeDasharray="20 100" strokeDashoffset="20" d="M70 80 C 170 80, 160 210, 260 210" />
                <path className="sd-bflow" pathLength="100" strokeDasharray="20 100" strokeDashoffset="20" d="M70 210 L 260 210" style={{ animationDelay: "2s" }} />
                <path className="sd-bflow" pathLength="100" strokeDasharray="20 100" strokeDashoffset="20" d="M70 340 C 170 340, 160 210, 260 210" style={{ animationDelay: "4s" }} />
                <path className="sd-bflow2" pathLength="100" strokeDasharray="20 100" strokeDashoffset="20" d="M260 210 L 450 210" style={{ animationDelay: "1.8s" }} />
              </g>
            </svg>
            {promises.slice(0, 3).map((pr, i) => (
              <span key={i} style={{ position: "absolute", left: "13.46%", top: DIAGRAM_Y[i], width: "0", height: "0" }}>
                <span style={{ position: "absolute", left: "-28px", top: "-28px", width: "56px", height: "56px", borderRadius: "50%", border: NODE_BORDER, background: NODE_BG, color: "oklch(var(--sd-primary-hi))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PromiseIcon name={pr.icon} size={22} />
                </span>
                <span style={{ position: "absolute", left: "-60px", top: "36px", width: "120px", textAlign: "center", fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: "oklch(var(--sd-fg-4))" }}>
                  <Editable section={section} path={{ scope: "item", index: i, key: "short" }} value={pr.short} hint="Légende courte sous l'icône du schéma.">
                    {pr.short}
                  </Editable>
                </span>
              </span>
            ))}
            <span style={{ position: "absolute", left: "50%", top: "50%", width: "0", height: "0" }}>
              <span style={{ position: "absolute", left: "-48px", top: "-48px", width: "96px", height: "96px", borderRadius: "28px", border: NODE_BORDER, background: NODE_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BrandMark width={54} />
              </span>
            </span>
            <span style={{ position: "absolute", left: "86.54%", top: "50%", width: "0", height: "0" }}>
              <span style={{ position: "absolute", left: "-32px", top: "-32px", width: "64px", height: "64px", borderRadius: "50%", border: NODE_BORDER, background: NODE_BG, color: "oklch(var(--sd-primary-hi))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21V9l9-6 9 6v12" />
                  <path d="M9 21v-6h6v6" />
                </svg>
              </span>
              <span style={{ position: "absolute", left: "-60px", top: "42px", width: "120px", textAlign: "center", fontFamily: FONT_MONO, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: "oklch(var(--sd-fg-4))" }}>Votre activité</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExpertiseMethod({ section }: { section: Section }) {
  const steps = section.items.map((item, i) => ({ title: str(item, "title"), text: str(item, "description"), delay: `${i}s` }));
  return (
    <section style={{ padding: "clamp(88px, 10vw, 136px) 0" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div className="sd-rv" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "20px 48px", marginBottom: "64px" }}>
          <div style={{ maxWidth: "720px" }}>
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
          <p style={{ margin: "0", maxWidth: "380px", fontSize: "16.5px", color: "oklch(var(--sd-fg-3))" }}>
            <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
              {frenchSpacing(section.subtitle)}
            </Editable>
          </p>
        </div>
        <div className="sd-rv" style={{ position: "relative" }}>
          <div className="sd-hide-sm" aria-hidden="true" style={{ position: "absolute", left: "28px", right: "28px", top: "27px", height: "1px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
            <span className="sd-travel" />
          </div>
          <ol style={{ position: "relative", margin: "0", padding: "0", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: "40px 28px" }}>
            {steps.map((st, i) => (
              <li key={i} style={{ position: "relative", display: "flex", flexDirection: "column", gap: "16px" }}>
                <ItemTools section={section} index={i} />
                <span className="sd-glow-dot" style={{ width: "56px", height: "56px", borderRadius: "50%", border: "1px solid oklch(var(--sd-primary) / 0.45)", background: "oklch(var(--sd-bg))", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_MONO, fontSize: "15px", color: "oklch(var(--sd-primary-hi))", animationDelay: st.delay }}>{String(i + 1).padStart(2, "0")}</span>
                <h3 style={{ margin: "8px 0 0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "22px", lineHeight: 1.25, letterSpacing: "-0.015em" }}>
                  <Editable section={section} path={{ scope: "item", index: i, key: "title" }} value={st.title}>
                    {st.title}
                  </Editable>
                </h3>
                <p style={{ margin: "0", fontSize: "15.5px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
                  <Editable section={section} path={{ scope: "item", index: i, key: "description" }} kind="textarea" value={st.text}>
                    {frenchSpacing(st.text)}
                  </Editable>
                </p>
              </li>
            ))}
          </ol>
          <AddItem section={section} template={{ phase: "", title: "Nouvelle étape", description: "Description de l'étape." }} label="Ajouter une étape" style={{ marginTop: "24px" }} />
        </div>
      </div>
    </section>
  );
}

function ExpertiseStack({ section }: { section: Section }) {
  const stack = section.items.map((item) => ({ name: str(item, "name"), logo: techLogo(str(item, "name"), str(item, "logo_url")) }));
  // « Python · Django » donne deux badges ; les 3 premiers sur l'orbite intérieure.
  const badges = stack.flatMap((s) => {
    const names = s.name.split("·").map((n) => n.trim()).filter(Boolean);
    return names.map((name) => ({ name, logo: names.length > 1 ? techLogo(name, "") : s.logo }));
  });
  const logoOf = new Map(badges.map((b) => [b.name, b.logo]));
  const inner = ring(badges.slice(0, 3).map((b) => b.name), -90);
  const outer = ring(badges.slice(3).map((b) => b.name), -45);
  return (
    <section style={{ padding: "clamp(88px, 10vw, 136px) 0", background: "oklch(var(--sd-bg-deep))", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "56px clamp(40px, 6vw, 96px)" }}>
        <div className="sd-rv" style={{ flex: "1 1 420px", minWidth: "0" }}>
          <Eyebrow>
            <Editable section={section} path={{ scope: "field", field: "kicker" }} value={section.kicker}>
              {section.kicker}
            </Editable>
          </Eyebrow>
          <h2 style={{ margin: "16px 0 0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(36px, 4.6vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.035em", textWrap: "balance" }}>
            <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
              <Title title={section.title} />
            </Editable>
          </h2>
          <p style={{ margin: "20px 0 0", maxWidth: "460px", fontSize: "18px", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
            <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
              {frenchSpacing(section.subtitle)}
            </Editable>
          </p>
          <StackEditorList section={section} />
        </div>
        <div aria-hidden="true" style={{ flex: "1 1 420px", minWidth: "0", display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: "min(480px, 100%)", aspectRatio: "1 / 1" }}>
            <div style={{ position: "absolute", inset: "0", borderRadius: "50%", border: "1px dashed rgba(255,255,255,0.1)" }} />
            <div style={{ position: "absolute", inset: "22%", borderRadius: "50%", border: "1px dashed rgba(255,255,255,0.12)" }} />
            <div style={{ position: "absolute", left: "50%", top: "50%", width: "84px", height: "84px", margin: "-42px 0 0 -42px", borderRadius: "24px", border: NODE_BORDER, background: NODE_BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BrandMark width={50} />
            </div>
            <div className="sd-rot" style={{ position: "absolute", inset: "22%" }}>
              {inner.map((o, i) => (
                <span key={i} className="sd-rot-r" style={{ position: "absolute", left: o.x, top: o.y, width: "0", height: "0" }}>
                  <span style={{ position: "absolute", transform: "translate(-50%, -50%)", display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", padding: "7px 14px 7px 10px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.14)", background: "oklch(0.152 0.015 240)", fontFamily: FONT_MONO, fontSize: "13px", color: "oklch(var(--sd-fg))", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)" }}>
                    <TechLogo src={logoOf.get(o.label) ?? ""} size={18} />
                    {o.label}
                  </span>
                </span>
              ))}
            </div>
            <div className="sd-rot2" style={{ position: "absolute", inset: "0" }}>
              {outer.map((o, i) => (
                <span key={i} className="sd-rot2-r" style={{ position: "absolute", left: o.x, top: o.y, width: "0", height: "0" }}>
                  <span style={{ position: "absolute", transform: "translate(-50%, -50%)", display: "inline-flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap", padding: "7px 14px 7px 10px", borderRadius: "999px", border: "1px solid oklch(var(--sd-primary) / 0.3)", background: "oklch(0.148 0.017 240)", fontFamily: FONT_MONO, fontSize: "13px", color: "oklch(var(--sd-primary-pale))", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)" }}>
                    <TechLogo src={logoOf.get(o.label) ?? ""} size={18} />
                    {o.label}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ExpertiseCta({ section }: { section: Section }) {
  return (
    <section style={{ padding: "clamp(88px, 10vw, 136px) 0" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div className="sd-beam sd-rv" style={{ position: "relative", overflow: "hidden", borderRadius: "30px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-surface))", padding: "clamp(48px, 7vw, 88px) clamp(24px, 5vw, 72px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "32px" }}>
          <div aria-hidden="true" className="sd-aurora sd-au1" style={{ width: "460px", height: "460px", left: "-120px", top: "-260px", background: "oklch(var(--sd-glow-1))", opacity: 0.38 }} />
          <div style={{ position: "relative", zIndex: 1, flex: "1 1 460px" }}>
            <h2 style={{ margin: "0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(32px, 4vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.035em", textWrap: "balance" }}>
              <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
                <Title title={section.title} />
              </Editable>
            </h2>
            <p style={{ margin: "16px 0 0", maxWidth: "520px", fontSize: "17px", color: "oklch(var(--sd-fg-3))" }}>
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

/** Page Expertise, partagée par le site public et l'éditeur visuel. */
export function ExpertiseView({ sections }: { sections: PageSection[] }) {
  const hero = resolveSection(sections, "expertise_hero", D.EXPERTISE_HERO);
  const promises = resolveSection(sections, "strategic_advantages", D.PROMISES);
  const method = resolveSection(sections, "process_timeline", D.METHOD);
  const stack = resolveSection(sections, "tech_stack", D.STACK);
  const cta = resolveSection(sections, "expertise_cta", D.EXPERTISE_CTA);
  return (
    <>
      {hero && (
        <EditableSection section={hero} name="Hero">
          <ExpertiseHero section={hero} />
        </EditableSection>
      )}
      {promises && (
        <EditableSection section={promises} name="Nos engagements">
          <ExpertisePromises section={promises} />
        </EditableSection>
      )}
      {method && (
        <EditableSection section={method} name="Notre méthode">
          <ExpertiseMethod section={method} />
        </EditableSection>
      )}
      {stack && (
        <EditableSection section={stack} name="Technologies">
          <ExpertiseStack section={stack} />
        </EditableSection>
      )}
      {cta && (
        <EditableSection section={cta} name="Appel à l'action">
          <ExpertiseCta section={cta} />
        </EditableSection>
      )}
    </>
  );
}
