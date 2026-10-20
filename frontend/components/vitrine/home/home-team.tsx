"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Title, frenchSpacing, str, type Section } from "../cms";
import { AddItem, Editable, ItemTools, useEditor } from "../editable";
import { Eyebrow, FONT_DISPLAY, FONT_DISPLAY_SYS, FONT_MONO } from "../ui";

/* Fonds des cartes sans photo : compositions de la maquette (couleur vive,
 * couleur secondaire, fond nuit), dans notre palette, en alternance. */
const GRADIENTS = [
  "linear-gradient(150deg, oklch(var(--sd-glow-1)) 0%, oklch(var(--sd-glow-2)) 55%, oklch(0.179 0.018 240) 100%)",
  "linear-gradient(150deg, oklch(var(--sd-glow-3)) 0%, oklch(var(--sd-glow-1)) 60%, oklch(0.151 0.018 240) 100%)",
  "linear-gradient(150deg, oklch(var(--sd-accent)) 0%, oklch(var(--sd-glow-2)) 60%, oklch(0.154 0.018 240) 100%)",
  "linear-gradient(150deg, oklch(var(--sd-glow-2)) 0%, oklch(var(--sd-glow-3)) 60%, oklch(0.154 0.012 240) 100%)",
];

/** Position dans la pile selon l'écart avec le membre affiché (0 = devant). */
const STACK = [
  { transform: "translate(0px, 0px) rotate(0deg) scale(1)", opacity: 1 },
  { transform: "translate(26px, 14px) rotate(6deg) scale(0.94)", opacity: 0.75 },
  { transform: "translate(-24px, 24px) rotate(-7deg) scale(0.9)", opacity: 0.5 },
  { transform: "translate(12px, 34px) rotate(3deg) scale(0.86)", opacity: 0.3 },
];

const ROTATE_MS = 5000;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

/** « Les visages derrière vos projets » : membres du CMS (photo, nom, rôle,
 * présentation) en pile de cartes qui tourne toutes les 5 s. */
export function HomeTeam({ section }: { section: Section }) {
  const team = section.items.map((item) => ({ name: str(item, "name"), role: str(item, "role").trim(), bio: str(item, "bio"), photo: str(item, "photo_url") }));
  const editor = useEditor();
  const [active, setActive] = useState(0);
  // Incrémenté à chaque choix manuel : relance le défilement automatique.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    // Pas de défilement automatique dans l'éditeur : on modifie le membre affiché.
    if (editor || team.length < 2) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % team.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [cycle, team.length, editor]);

  if (!team.length) return null;
  const current = Math.min(active, team.length - 1);
  const pick = (i: number) => {
    setActive((i + team.length) % team.length);
    setCycle((c) => c + 1);
  };
  const depth = (i: number) => (i - current + team.length) % team.length;
  const member = team[current];
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <section id="equipe" style={{ padding: "clamp(88px, 10vw, 136px) 0", background: "oklch(var(--sd-bg-deep))", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div className="sd-rv" style={{ maxWidth: "720px", marginBottom: "56px" }}>
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
          <p style={{ margin: "18px 0 0", fontSize: "17.5px", color: "oklch(var(--sd-fg-3))" }}>
            <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
              {frenchSpacing(section.subtitle)}
            </Editable>
          </p>
        </div>
        <div className="sd-rv" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "56px clamp(48px, 7vw, 112px)" }}>
          <div aria-hidden={editor ? undefined : "true"} style={{ flex: "1 1 360px", minWidth: "0", display: "flex", justifyContent: "center", padding: "20px 0 40px" }}>
            <div style={{ position: "relative", width: "min(340px, 80vw)", aspectRatio: "4 / 5" }}>
              {team.map((m, i) => {
                const d = depth(i);
                const place = STACK[Math.min(d, STACK.length - 1)];
                const card = (
                  <>
                    {m.photo ? (
                      <Image src={m.photo} alt="" fill sizes="340px" style={{ objectFit: "cover", objectPosition: "center top" }} />
                    ) : (
                      <>
                        <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.16) 1px, transparent 1px)", backgroundSize: "16px 16px", WebkitMaskImage: "linear-gradient(160deg, #000 10%, transparent 70%)", maskImage: "linear-gradient(160deg, #000 10%, transparent 70%)" }} />
                        <div style={{ position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: "clamp(96px, 11vw, 140px)", letterSpacing: "-0.05em", color: "rgba(255,255,255,0.92)" }}>{initials(m.name)}</div>
                      </>
                    )}
                    <div style={{ position: "absolute", left: "0", right: "0", bottom: "0", padding: "22px 22px 20px", background: "linear-gradient(180deg, transparent, oklch(0.080 0.008 240 / 0.85))", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 600, color: "#FFFFFF" }}>{m.name}</span>
                      <span style={{ fontSize: "12.5px", color: "rgba(255,255,255,0.75)" }}>{m.role}</span>
                    </div>
                  </>
                );
                return (
                  <div key={i} style={{ position: "absolute", inset: "0", borderRadius: "28px", overflow: "hidden", background: GRADIENTS[i % GRADIENTS.length], border: "1px solid rgba(255,255,255,0.14)", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.85)", transform: place.transform, opacity: d < STACK.length ? place.opacity : 0, zIndex: team.length - d, transition: "transform 0.8s cubic-bezier(.2,.8,.2,1), opacity 0.8s ease" }}>
                    {d === 0 ? (
                      <Editable section={section} path={{ scope: "item", index: i, key: "photo_url" }} kind="image" value={m.photo} hint={`Photo de ${m.name} (format portrait de préférence).`}>
                        <span style={{ position: "absolute", inset: "0", display: "block" }}>{card}</span>
                      </Editable>
                    ) : (
                      card
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ position: "relative", flex: "1 1 420px", minWidth: "0" }}>
            <ItemTools section={section} index={current} />
            <span style={{ fontFamily: FONT_MONO, fontSize: "13px", letterSpacing: "0.08em", color: "oklch(var(--sd-fg-4))" }}>{`${pad(current + 1)} / ${pad(team.length)}`}</span>
            <div style={{ minHeight: "220px", marginTop: "18px" }}>
              <div key={current} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <h3 className="sd-bwb" style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(32px, 3.6vw, 48px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
                  <Editable section={section} path={{ scope: "item", index: current, key: "name" }} value={member.name}>
                    {member.name}
                  </Editable>
                </h3>
                <p className="sd-bwb" style={{ margin: "0", fontSize: "16px", fontWeight: 500, color: "oklch(var(--sd-primary-hi))", animationDelay: "0.1s" }}>
                  <Editable section={section} path={{ scope: "item", index: current, key: "role" }} value={member.role}>
                    {member.role}
                  </Editable>
                </p>
                <p className="sd-bwb" style={{ margin: "4px 0 0", maxWidth: "480px", fontSize: "17px", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", animationDelay: "0.2s" }}>
                  <Editable section={section} path={{ scope: "item", index: current, key: "bio" }} kind="textarea" value={member.bio}>
                    {frenchSpacing(member.bio)}
                  </Editable>
                </p>
              </div>
            </div>
            <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "20px 28px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="sd-tbtn" type="button" onClick={() => pick(current - 1)} aria-label="Membre précédent" style={{ width: "48px", height: "48px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "oklch(var(--sd-fg))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </button>
                <button className="sd-tbtn" type="button" onClick={() => pick(current + 1)} aria-label="Membre suivant" style={{ width: "48px", height: "48px", borderRadius: "50%", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "oklch(var(--sd-fg))", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
              <AddItem section={section} template={{ name: "Nouveau membre", role: "Poste", bio: "Présentation en une ou deux phrases.", photo_url: "" }} label="Ajouter un membre" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
