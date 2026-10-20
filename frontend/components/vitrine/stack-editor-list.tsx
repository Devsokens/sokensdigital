"use client";

import { str, type Section } from "./cms";
import { AddItem, Editable, ItemTools, useEditor } from "./editable";
import { TechLogo, techLogo } from "./tech-logos";

/** Liste des technologies, visible uniquement dans l'éditeur de l'admin : sur
 * le site, elles n'apparaissent que sur l'orbite animée (difficile à cliquer
 * pendant qu'elle tourne). Nom et logo modifiables, ajout / suppression. */
export function StackEditorList({ section }: { section: Section }) {
  const editor = useEditor();
  if (!editor) return null;
  return (
    <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {section.items.map((item, i) => {
        const name = str(item, "name");
        const logo = techLogo(name, str(item, "logo_url"));
        return (
          <span key={i} style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 40px 8px 10px", borderRadius: "999px", border: "1px dashed rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.03)", fontSize: "14px" }}>
            <ItemTools section={section} index={i} />
            <Editable section={section} path={{ scope: "item", index: i, key: "logo_url" }} kind="image" value={logo} hint="Logo de la technologie (SVG ou PNG sur fond transparent).">
              <span style={{ width: "26px", height: "26px", borderRadius: "8px", background: "rgba(255,255,255,0.06)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <TechLogo src={logo} size={18} />
              </span>
            </Editable>
            <Editable section={section} path={{ scope: "item", index: i, key: "name" }} value={name}>
              {name}
            </Editable>
          </span>
        );
      })}
      <AddItem section={section} template={{ name: "Nouvel outil", label: "", logo_url: "" }} label="Ajouter une technologie" style={{ minHeight: "42px", borderRadius: "999px" }} />
    </div>
  );
}
