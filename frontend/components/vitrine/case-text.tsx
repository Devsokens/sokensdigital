import { frenchSpacing } from "./cms";

/* Mise en forme des textes longs d'une étude de cas (Le défi, La solution),
 * saisis en texte brut dans le CMS :
 *   * Intitulé : texte        → point, intitulé en gras
 *   * Intitulé :              → point-titre, les lignes suivantes en dessous
 *   ligne sans « * »          → paragraphe (sous le point précédent s'il y en a un) */

type Point = { lead: string; text: string; details: string[] };

/** « Intitulé : texte » → { lead, text } ; `lead` vide quand la ligne n'a pas d'intitulé. */
export function splitLead(content: string) {
  const match = content.match(/^(.{2,90}?)\s*:\s+(.+)$/);
  return match ? { lead: match[1], text: match[2] } : { lead: "", text: content };
}

export function parseCaseText(text: string) {
  const intro: string[] = [];
  const points: Point[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^[*•-]\s*(.*)$/);
    if (bullet) {
      const content = bullet[1].trim();
      const { lead, text: rest } = splitLead(content);
      if (lead) points.push({ lead, text: rest, details: [] });
      else if (content.endsWith(":")) points.push({ lead: content.slice(0, -1).trim(), text: "", details: [] });
      else points.push({ lead: "", text: content, details: [] });
    } else if (points.length) {
      points[points.length - 1].details.push(line);
    } else {
      intro.push(line);
    }
  }
  return { intro, points };
}

export function CaseText({ text }: { text: string }) {
  const { intro, points } = parseCaseText(text);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {intro.map((p, i) => (
        <p key={i} style={{ margin: "0", fontSize: "16px", lineHeight: 1.7, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>{frenchSpacing(p)}</p>
      ))}
      {points.length > 0 && (
        <ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "14px" }}>
          {points.map((point, i) => (
            <li key={i} style={{ display: "flex", gap: "14px" }}>
              <span aria-hidden="true" style={{ flex: "none", width: "7px", height: "7px", marginTop: "10px", borderRadius: "50%", background: "oklch(var(--sd-primary))" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "0" }}>
                <p style={{ margin: "0", fontSize: "16px", lineHeight: 1.7, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
                  {point.lead && <strong style={{ fontWeight: 600, color: "oklch(var(--sd-fg))" }}>{frenchSpacing(point.lead)}{point.text ? " : " : ""}</strong>}
                  {frenchSpacing(point.text)}
                </p>
                {point.details.map((detail, j) => (
                  <p key={j} style={{ margin: "0", paddingLeft: "14px", borderLeft: "2px solid rgba(255,255,255,0.08)", fontSize: "15px", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>{frenchSpacing(detail)}</p>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
