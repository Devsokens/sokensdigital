"use client";

import type { Project } from "@/lib/projects/types";
import { CaseText } from "./case-text";
import { Editable, useEditor } from "./editable";
import { FONT_DISPLAY } from "./ui";

const CASE_HINT = "Commencez une ligne par * pour créer un point. « Intitulé : texte » met l'intitulé en gras ; les lignes sans * s'affichent sous le point précédent.";

/** Étude de cas complète (Le défi, La solution), repliée par défaut pour
 * garder la page légère ; toujours ouverte dans l'éditeur. */
export function ProjectCaseStudy({ project }: { project: Project }) {
  const editor = useEditor();
  return (
    <details className="sd-case" open={editor ? true : undefined} style={{ borderRadius: "22px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.015)" }}>
      <summary style={{ listStyle: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", padding: "22px 26px" }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(19px, 2vw, 23px)", letterSpacing: "-0.015em" }}>Lire l&apos;étude de cas complète</span>
        <svg className="sd-case-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", color: "oklch(var(--sd-primary-hi))" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div style={{ padding: "4px 26px 28px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(380px, 100%), 1fr))", gap: "32px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h3 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "21px", letterSpacing: "-0.015em" }}>Le défi</h3>
          <Editable path={{ scope: "project", key: "challenge" }} kind="textarea" value={project.challenge} hint={CASE_HINT}>
            <CaseText text={project.challenge || (editor ? "* Ajouter le défi du client" : "")} />
          </Editable>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h3 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "21px", letterSpacing: "-0.015em" }}>La solution</h3>
          <Editable path={{ scope: "project", key: "solution" }} kind="textarea" value={project.solution} hint={CASE_HINT}>
            <CaseText text={project.solution || (editor ? "* Ajouter la solution apportée" : "")} />
          </Editable>
        </div>
      </div>
    </details>
  );
}
