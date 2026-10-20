"use client";

import Image from "next/image";
import { useState } from "react";
import type { Project } from "@/lib/projects/types";
import { Editable, useEditor } from "./editable";
import { projectHost } from "./project-screen";
import { FONT_DISPLAY, FONT_MONO } from "./ui";

/** Grande capture du projet dans le cadre navigateur, et miniatures pour
 * passer d'une capture à l'autre. La vidéo, si le projet en a une, passe en
 * premier. Dans l'éditeur, un clic sur la capture affichée la remplace. */
export function ProjectGallery({ project }: { project: Project }) {
  const editor = useEditor();
  const images = project.images ?? [];
  // -1 = la vidéo, sinon l'index de la capture affichée.
  const [current, setCurrent] = useState(project.videoSrc ? -1 : 0);
  const showVideo = Boolean(project.videoSrc) && (current === -1 || !images.length);
  const index = Math.min(Math.max(current, 0), Math.max(images.length - 1, 0));
  const media = showVideo ? (
    <video src={project.videoSrc} autoPlay loop muted playsInline style={{ position: "absolute", inset: "0", width: "100%", height: "100%", objectFit: "cover" }} />
  ) : images[index] ? (
    <Image src={images[index]} alt={`Aperçu du site ${project.title}`} fill priority sizes="(max-width: 1240px) 92vw, 1160px" style={{ objectFit: "cover", objectPosition: "top center" }} />
  ) : (
    <span style={{ position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "32px", color: "oklch(var(--sd-fg-3))" }}>{project.title}</span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div className="sd-bw" style={{ animationDelay: "0.45s", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.12)", background: "oklch(var(--sd-panel))", overflow: "hidden", boxShadow: "0 50px 100px -40px rgba(0,0,0,0.85)" }}>
        <div style={{ height: "38px", display: "flex", alignItems: "center", gap: "6px", padding: "0 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
          <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
          <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
          <span style={{ marginLeft: "14px", padding: "3px 12px", borderRadius: "7px", background: "rgba(255,255,255,0.05)", fontFamily: FONT_MONO, fontSize: "11.5px", color: "oklch(var(--sd-fg-4))" }}>{projectHost(project)}</span>
        </div>
        <div style={{ position: "relative", aspectRatio: "16 / 9", background: "oklch(var(--sd-panel-deep))" }}>
          {editor && images[index] && !showVideo ? (
            <Editable path={{ scope: "project", key: "images", index }} kind="image" value={images[index]} hint="Capture d'écran du site (format paysage). Ajoutez ou retirez des captures dans la barre au-dessus de l'aperçu.">
              <span style={{ position: "absolute", inset: "0", display: "block" }}>{media}</span>
            </Editable>
          ) : (
            media
          )}
        </div>
      </div>
      {(images.length > 1 || (project.videoSrc && images.length > 0)) && (
        <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
          {project.videoSrc && (
            <button type="button" onClick={() => setCurrent(-1)} aria-label="Voir la vidéo" aria-pressed={showVideo} style={{ flex: "none", width: "120px", aspectRatio: "16 / 10", borderRadius: "10px", border: `2px solid ${showVideo ? "oklch(var(--sd-primary))" : "rgba(255,255,255,0.1)"}`, background: "oklch(var(--sd-panel))", color: "oklch(var(--sd-fg-2))", fontSize: "12px", cursor: "pointer" }}>
              ▶ Vidéo
            </button>
          )}
          {images.map((src, i) => (
            <button key={src + i} type="button" onClick={() => setCurrent(i)} aria-label={`Voir la capture ${i + 1}`} aria-pressed={!showVideo && i === index} style={{ position: "relative", flex: "none", width: "120px", aspectRatio: "16 / 10", padding: "0", borderRadius: "10px", overflow: "hidden", border: `2px solid ${!showVideo && i === index ? "oklch(var(--sd-primary))" : "rgba(255,255,255,0.1)"}`, background: "oklch(var(--sd-panel))", cursor: "pointer", opacity: !showVideo && i === index ? 1 : 0.7, transition: "opacity .2s ease, border-color .2s ease" }}>
              <Image src={src} alt="" fill sizes="120px" style={{ objectFit: "cover", objectPosition: "top center" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
