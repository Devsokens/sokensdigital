import Image from "next/image";
import type { CSSProperties } from "react";
import type { Project } from "@/lib/projects/types";
import { FONT_DISPLAY, FONT_MONO } from "./ui";

/** Domaine affiché dans la barre d'adresse du cadre (« nfl-ga.com »). */
export function projectHost(project: Project) {
  if (!project.projectUrl) return `${project.slug}.com`;
  try {
    return new URL(project.projectUrl).hostname.replace(/^www\./, "");
  } catch {
    return project.projectUrl;
  }
}

/** Premier paragraphe d'un texte long du CMS, sans puces « * », raccourci. */
export function excerpt(text: string, max = 200) {
  const paragraph = text
    .split(/\n\s*\n|\n/)
    .map((p) => p.replace(/^\s*[*•-]\s*/, "").trim())
    .find((p) => p.length > 40) ?? text.trim();
  return paragraph.length > max ? `${paragraph.slice(0, max).replace(/\s+\S*$/, "")}…` : paragraph;
}

/** Cadre « navigateur » de la maquette contenant la vraie capture d'écran du
 * projet (première image du CMS), ou son nom si aucune capture n'existe. */
export function ProjectScreen({ project, style, compact = false, sizes }: { project: Project; style?: CSSProperties; compact?: boolean; sizes: string }) {
  const image = project.images?.[0];
  return (
    <div className="sd-zoom" style={{ position: "relative", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", background: "oklch(var(--sd-panel))", overflow: "hidden", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.8)", ...style }}>
      <div style={{ height: compact ? "30px" : "32px", display: "flex", alignItems: "center", gap: "5px", padding: "0 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
        <span style={{ marginLeft: "12px", padding: "2px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", fontFamily: FONT_MONO, fontSize: compact ? "10px" : "10.5px", color: "oklch(var(--sd-fg-4))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{projectHost(project)}</span>
      </div>
      <div style={{ position: "relative", aspectRatio: "16 / 10", background: "oklch(var(--sd-panel-deep))" }}>
        {image ? (
          <Image src={image} alt={`Aperçu du site ${project.title}`} fill sizes={sizes} style={{ objectFit: "cover", objectPosition: "top center" }} />
        ) : (
          <span style={{ position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", textAlign: "center", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "26px", letterSpacing: "-0.02em", color: "oklch(var(--sd-fg-3))" }}>{project.title}</span>
        )}
      </div>
    </div>
  );
}
