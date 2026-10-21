"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Title, frenchSpacing, str, strList, type Section } from "../cms";
import { AddItem, Editable, ItemTools, useEditor } from "../editable";
import { Eyebrow, FONT_DISPLAY, FONT_DISPLAY_SYS, FONT_MONO } from "../ui";
import { AuditVisual, MobileVisual, SoftwareVisual, WebVisual } from "./service-visuals";

/** Visuel animé associé à chaque service (choisi dans le CMS, sinon selon la
 * position). Une image (`image_url`) le remplace quand elle est renseignée. */
const VISUALS = { web: WebVisual, mobile: MobileVisual, logiciel: SoftwareVisual, audit: AuditVisual };
const VISUAL_ORDER = ["web", "mobile", "logiciel", "audit"] as const;
const VISUAL_LABELS: Record<(typeof VISUAL_ORDER)[number], string> = { web: "Site web", mobile: "Mobile", logiciel: "Logiciel", audit: "Audit" };
const IMAGE_HINT = "Image affichée à la place de l'animation (format paysage de préférence). Retirez-la pour revenir à l'animation.";

/** Durée d'affichage de chaque service avant de passer au suivant (= barre de progression). */
const ROTATE_MS = 6500;

export function HomeServices({ section }: { section: Section }) {
  // Pas de filtrage : l'index doit rester celui de l'élément dans le CMS (édition).
  const services = section.items
    .map((item, i) => {
      const visual = str(item, "visual") as keyof typeof VISUALS;
      return {
        visualKey: VISUALS[visual] ? visual : VISUAL_ORDER[i % VISUAL_ORDER.length],
        title: str(item, "title"),
        text: str(item, "description"),
        points: strList(item.points),
        image: str(item, "image_url"),
        Visual: VISUALS[visual] ?? VISUALS[VISUAL_ORDER[i % VISUAL_ORDER.length]],
      };
    });
  const editor = useEditor();
  const [active, setActive] = useState(0);
  // Incrémenté à chaque choix manuel : relance le minuteur et la barre de progression.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    // Pas de défilement automatique dans l'éditeur : on modifie le service ouvert.
    if (editor) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % Math.max(services.length, 1)), ROTATE_MS);
    return () => clearInterval(timer);
  }, [cycle, services.length, editor]);

  const pick = (i: number) => {
    setActive(i);
    setCycle((c) => c + 1);
  };

  if (!services.length) return null;
  const current = Math.min(active, services.length - 1);
  const { Visual, image } = services[current];

  return (
    <section id="services" style={{ padding: "clamp(88px, 10vw, 136px) 0" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div className="sd-rv" style={{ maxWidth: "760px", marginBottom: "56px" }}>
          {section.kicker && (
            <Eyebrow>
              <Editable section={section} path={{ scope: "field", field: "kicker" }} value={section.kicker}>
                {section.kicker}
              </Editable>
            </Eyebrow>
          )}
          <h2 style={{ margin: "16px 0 0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(36px, 4.6vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.035em", textWrap: "balance" }}>
            <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
              <Title title={section.title} />
            </Editable>
          </h2>
          <p style={{ margin: "18px 0 0", maxWidth: "580px", fontSize: "17.5px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
            <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
              {frenchSpacing(section.subtitle)}
            </Editable>
          </p>
        </div>
        <div className="sd-rv" style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", gap: "40px clamp(32px, 5vw, 72px)" }}>
          <div style={{ flex: "1 1 380px", minWidth: "0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            {services.map((service, i) => {
              const on = i === current;
              return (
                <div key={i} style={{ position: "relative", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <ItemTools section={section} index={i} />
                  <button className="sd-svc-btn" type="button" onClick={() => pick(i)} aria-expanded={on} style={{ width: "100%", display: "flex", alignItems: "center", gap: "18px", padding: "24px 0", border: "0", background: "transparent", color: on ? "oklch(var(--sd-fg))" : "oklch(var(--sd-fg-4))", fontFamily: "inherit", textAlign: "left", cursor: "pointer" }}>
                    <span style={{ fontFamily: FONT_MONO, fontSize: "13px", color: on ? "oklch(var(--sd-primary-hi))" : "oklch(0.505 0.016 240)" }}>{`0${i + 1}`}</span>
                    <span style={{ flex: 1, fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(21px, 2vw, 26px)", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                      <Editable section={section} path={{ scope: "item", index: i, key: "title" }} value={service.title}>
                        {service.title}
                      </Editable>
                    </span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", transition: "transform .3s ease", transform: `rotate(${on ? "180deg" : "0deg"})` }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {on && (
                    <div key={cycle} className="sd-vin" style={{ padding: "0 0 24px 38px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <p style={{ margin: "0", fontSize: "16px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
                        <Editable section={section} path={{ scope: "item", index: i, key: "description" }} kind="textarea" value={service.text}>
                          {frenchSpacing(service.text)}
                        </Editable>
                      </p>
                      <Editable section={section} path={{ scope: "item", index: i, key: "points" }} kind="list" value={service.points} hint="Un point par ligne.">
                      <ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                        {service.points.map((point) => (
                          <li key={point} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "15px", color: "oklch(var(--sd-fg-2b))" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="oklch(var(--sd-primary))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M5 12.5l4.5 4.5L19 7.5" />
                            </svg>
                            {point}
                          </li>
                        ))}
                      </ul>
                      </Editable>
                      <span aria-hidden="true" style={{ display: "block", height: "2px", borderRadius: "2px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                        <span className="sd-prog" style={{ display: "block", height: "100%", background: "linear-gradient(90deg, oklch(var(--sd-primary)), oklch(var(--sd-accent-hi)))" }} />
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
            <AddItem section={section} template={{ title: "Nouveau service", description: "Description du service.", points: ["Premier point"], visual: "web" }} label="Ajouter un service" style={{ margin: "16px 0" }} />
          </div>
          <div aria-hidden={editor ? undefined : "true"} style={{ flex: "1.35 1 520px", minWidth: "0", minHeight: "500px", position: "relative", overflow: "hidden", borderRadius: "28px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-panel-deep))", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(24px, 4vw, 48px)" }}>
            <div className="sd-aurora sd-au1" style={{ width: "420px", height: "420px", left: "-120px", top: "-160px", background: "oklch(var(--sd-glow-1))", opacity: 0.28 }} />
            <div className="sd-aurora sd-au2" style={{ width: "380px", height: "380px", right: "-120px", bottom: "-160px", background: "oklch(var(--sd-glow-2))", opacity: 0.24 }} />
            <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "22px 22px", WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, #000 20%, transparent 80%)", maskImage: "radial-gradient(ellipse 70% 70% at 50% 50%, #000 20%, transparent 80%)" }} />
            {image ? (
              <div key={`image-${current}`} className="sd-vin" style={{ position: "absolute", inset: "0", zIndex: 1, overflow: "hidden" }}>
                <Editable section={section} path={{ scope: "item", index: current, key: "image_url" }} kind="image" value={image} hint={IMAGE_HINT}>
                  <Image className="sd-kb" src={image} alt="" fill sizes="(max-width: 860px) 92vw, 680px" style={{ objectFit: "cover" }} />
                </Editable>
              </div>
            ) : (
              <Visual key={current} />
            )}
            {editor && (
              <div style={{ position: "absolute", top: "14px", right: "14px", zIndex: 5, display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {/* Choisir une animation retire l'image éventuelle. */}
                {VISUAL_ORDER.map((key) => (
                  <button key={key} type="button" className="sd-add-item" style={{ minHeight: "32px", padding: "4px 12px", fontSize: "12.5px", ...(!image && services[current].visualKey === key ? { borderStyle: "solid", background: "oklch(var(--sd-primary) / 0.2)" } : {}) }} onClick={() => editor.setItems(section, section.items.map((item, i) => (i === current ? { ...item, visual: key, image_url: "" } : item)))}>
                    {VISUAL_LABELS[key]}
                  </button>
                ))}
                <button type="button" className="sd-add-item" style={{ minHeight: "32px", padding: "4px 12px", fontSize: "12.5px", ...(image ? { borderStyle: "solid", background: "oklch(var(--sd-primary) / 0.2)" } : {}) }} onClick={() => editor.open({ section, path: { scope: "item", index: current, key: "image_url" }, kind: "image", value: image, hint: IMAGE_HINT, label: `${section.key}.${current + 1}.image_url` })}>
                  {image ? "Changer l'image" : "Image"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
