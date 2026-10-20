import Link from "next/link";
import { AnimatedTitle, frenchSpacing, strList, type Section } from "../cms";
import { Editable } from "../editable";
import { ArrowIcon, FONT_DISPLAY_SYS, HEADER_HEIGHT, underHeader } from "../ui";
import { HeroStats } from "./hero-stats";

/* Étoiles filantes du hero : positions, délais et durées de la maquette. */
const METEORS = [
  { left: "8%", top: "-2%", delay: "0s", dur: "7s" },
  { left: "18%", top: "-6%", delay: "2.6s", dur: "8.5s" },
  { left: "27%", top: "-3%", delay: "4.8s", dur: "6.6s" },
  { left: "36%", top: "-8%", delay: "1.4s", dur: "9s" },
  { left: "45%", top: "-2%", delay: "6.1s", dur: "7.4s" },
  { left: "54%", top: "-5%", delay: "3.3s", dur: "8.2s" },
  { left: "63%", top: "-3%", delay: "0.7s", dur: "6.9s" },
  { left: "72%", top: "-7%", delay: "5.5s", dur: "9.4s" },
  { left: "14%", top: "12%", delay: "7.2s", dur: "7.8s" },
  { left: "42%", top: "10%", delay: "8.4s", dur: "8.8s" },
];

/** Défilement vertical des mots (« site web », « application mobile »…) :
 * chaque mot reste affiché 80 % de son créneau puis glisse vers le suivant ;
 * le premier est répété en fin de liste pour boucler sans saut. */
function flipKeyframes(count: number) {
  const slot = 100 / count;
  const frames = Array.from({ length: count }, (_, k) => `${(k * slot).toFixed(2)}%,${(k * slot + slot * 0.8).toFixed(2)}%{transform:translateY(-${(k * 1.35).toFixed(2)}em)}`);
  return `@keyframes sd-flip-${count}{${frames.join("")}100%{transform:translateY(-${(count * 1.35).toFixed(2)}em)}}`;
}

export function HomeHero({ hero }: { hero: Section }) {
  const words = strList(hero.extra.rotating_words);
  const prefix = typeof hero.extra.rotating_prefix === "string" ? hero.extra.rotating_prefix : "";

  return (
    <section style={{ position: "relative", overflow: "hidden", ...underHeader("clamp(72px, 9vw, 120px)", "clamp(72px, 8vw, 104px)") }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
        <div className="sd-aurora sd-au1" style={{ width: "640px", height: "640px", left: "6%", top: `${-260 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-1))", opacity: 0.34 }} />
        <div className="sd-aurora sd-au2" style={{ width: "580px", height: "580px", right: "2%", top: `${-200 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-2))", opacity: 0.26 }} />
        <div className="sd-aurora sd-au3" style={{ width: "520px", height: "520px", left: "36%", top: `${160 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-3))", opacity: 0.14 }} />
        <div style={{ position: "absolute", inset: "0", backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "64px 64px", WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 28%, #000 15%, transparent 75%)", maskImage: "radial-gradient(ellipse 60% 50% at 50% 28%, #000 15%, transparent 75%)" }} />
        <div className="sd-retro">
          <div className="sd-retro-p">
            <div className="sd-retro-g" />
          </div>
        </div>
        {METEORS.map((m) => (
          <span key={`${m.left}${m.top}`} className="sd-meteor" style={{ left: m.left, top: m.top, animationDelay: m.delay, animationDuration: m.dur }} />
        ))}
      </div>
      <div style={{ position: "relative", zIndex: 1, maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <h1 style={{ margin: "0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(46px, 7.2vw, 102px)", lineHeight: 0.98, letterSpacing: "-0.045em" }}>
          <Editable section={hero} path={{ scope: "field", field: "title" }} value={hero.title} hint="La partie entre *astérisques* s'affiche en dégradé, sur sa propre ligne.">
            <AnimatedTitle title={hero.title} start={0.1} step={0.1} highlightDelay={0.42} breakLine />
          </Editable>
        </h1>
        <p className="sd-bw" style={{ animationDelay: "0.58s", margin: "30px 0 0", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: "0 10px", fontSize: "clamp(19px, 2vw, 25px)", lineHeight: 1.35, color: "oklch(var(--sd-fg-2))" }}>
          {prefix && (
            <Editable section={hero} path={{ scope: "extra", key: "rotating_prefix" }} value={prefix}>
              <span>{prefix}</span>
            </Editable>
          )}
          <Editable section={hero} path={{ scope: "extra", key: "rotating_words" }} kind="list" value={words} hint="Un mot ou groupe de mots par ligne : ils défilent à tour de rôle.">
            {words.length > 1 ? (
              <span className="sd-flip" style={{ color: "oklch(var(--sd-primary-hi))", fontWeight: 500 }}>
                <style>{flipKeyframes(words.length)}</style>
                <span className="sd-flip-in" style={{ animation: `sd-flip-${words.length} ${words.length * 2.5}s cubic-bezier(.7,0,.2,1) infinite` }}>
                  {[...words, words[0]].map((word, i) => (
                    <span key={i}>{word}</span>
                  ))}
                </span>
              </span>
            ) : (
              <span style={{ color: "oklch(var(--sd-primary-hi))", fontWeight: 500 }}>{words[0]}</span>
            )}
          </Editable>
        </p>
        <p className="sd-bw" style={{ animationDelay: "0.68s", margin: "20px 0 0", maxWidth: "620px", fontSize: "clamp(16px, 1.4vw, 18px)", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
          <Editable section={hero} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={hero.subtitle}>
            {frenchSpacing(hero.subtitle)}
          </Editable>
        </p>
        <div className="sd-bw sd-btn-row" style={{ animationDelay: "0.8s", marginTop: "40px", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "12px" }}>
          <Link className="sd-shimmer sd-arrow-link" href={hero.ctaLink} style={{ display: "inline-flex", alignItems: "center", gap: "10px", height: "54px", padding: "0 26px", borderRadius: "12px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontWeight: 600, fontSize: "16px" }}>
            <Editable section={hero} path={{ scope: "field", field: "cta" }} kind="link" value={{ label: hero.ctaLabel, href: hero.ctaLink }}>
              {hero.ctaLabel}
            </Editable>
            <ArrowIcon size={18} />
          </Link>
          {hero.ctaSecondaryLabel && (
            <Link className="sd-ghost sd-arrow-link" href={hero.ctaSecondaryLink} style={{ display: "inline-flex", alignItems: "center", gap: "10px", height: "54px", padding: "0 24px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "oklch(var(--sd-fg))", fontWeight: 500, fontSize: "16px" }}>
              <Editable section={hero} path={{ scope: "field", field: "ctaSecondary" }} kind="link" value={{ label: hero.ctaSecondaryLabel, href: hero.ctaSecondaryLink }}>
                {hero.ctaSecondaryLabel}
              </Editable>
              <ArrowIcon size={18} />
            </Link>
          )}
        </div>
        <HeroStats section={hero} />
      </div>
    </section>
  );
}
