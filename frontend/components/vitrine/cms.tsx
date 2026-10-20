import { Fragment, type ReactNode } from "react";
import type { PageSection } from "@/lib/api/types";

/* Lecture des sections du CMS (PageSection) par la vitrine. Chaque champ
 * vide ou absent reprend la valeur par défaut (textes de la maquette, voir
 * defaults.ts) : le site reste complet si l'API ne répond pas ou si une
 * section n'a pas encore été créée. */

export type Section = {
  /** Identifiant de la ligne PageSection (absent si la section n'existe pas encore en base). */
  id?: string;
  /** Clé de la section (« hero », « services »…), sert aussi d'étiquette dans l'éditeur. */
  key: string;
  /** Faux uniquement dans l'éditeur, pour une section masquée (le site public ne la reçoit pas). */
  isActive: boolean;
  kicker: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaLink: string;
  ctaSecondaryLabel: string;
  ctaSecondaryLink: string;
  items: Record<string, unknown>[];
  extra: Record<string, unknown>;
};

/** Section d'une page, ou null si elle doit rester cachée. L'API publique ne
 * renvoie que les sections visibles : une clé absente d'une réponse non vide
 * a été masquée depuis le CMS. Réponse vide (API injoignable) : on affiche
 * le contenu par défaut. */
export function resolveSection(sections: PageSection[], key: string, fallback: Partial<Section>): Section | null {
  const section = sections.find((s) => s.section_key === key);
  if (!section && sections.length > 0) return null;
  return fromCms(section, fallback, key);
}

/* Ancres de l'ancien site (une seule page) encore présentes dans le CMS :
 * elles pointent désormais vers les vraies pages. */
const LEGACY_LINKS: Record<string, string> = {
  "#expertise": "/expertise",
  "#services": "/expertise",
  "#projets": "/projects",
  "#projects": "/projects",
  "#blog": "/blog",
  "#contact": "/contact",
};

export function cmsHref(href: string) {
  return LEGACY_LINKS[href.trim()] ?? href;
}

export function fromCms(section: PageSection | null | undefined, fallback: Partial<Section>, key = section?.section_key ?? ""): Section {
  const pick = (value: string | undefined, def: string | undefined) => (value?.trim() ? value : def ?? "");
  return {
    id: section?.id,
    key,
    isActive: section?.is_active ?? true,
    kicker: pick(section?.kicker, fallback.kicker),
    title: pick(section?.title, fallback.title),
    subtitle: pick(section?.subtitle, fallback.subtitle),
    ctaLabel: pick(section?.cta_label, fallback.ctaLabel),
    ctaLink: cmsHref(pick(section?.cta_link, fallback.ctaLink)),
    ctaSecondaryLabel: pick(section?.cta_secondary_label, fallback.ctaSecondaryLabel),
    ctaSecondaryLink: cmsHref(pick(section?.cta_secondary_link, fallback.ctaSecondaryLink)),
    items: section?.items?.length ? section.items : fallback.items ?? [],
    extra: { ...fallback.extra, ...withoutEmpty(section?.extra) },
  };
}

function withoutEmpty(extra: Record<string, unknown> | undefined) {
  return Object.fromEntries(
    Object.entries(extra ?? {}).filter(([, v]) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v != null)),
  );
}

/** Lit une chaîne dans un élément de liste du CMS (JSON libre). */
export function str(item: Record<string, unknown>, key: string): string {
  const value = item[key];
  return typeof value === "string" ? value : "";
}

/** Lit une liste de chaînes (tableau, ou texte avec une entrée par ligne). */
export function strList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (typeof value === "string") return value.split("\n").map((v) => v.trim()).filter(Boolean);
  return [];
}

/** Espaces insécables avant la ponctuation haute, comme en typographie française. */
export function frenchSpacing(text: string) {
  return text.replace(/ ([?!:;»])/g, " $1").replace(/(«) /g, "$1 ");
}

type Part = { text: string; highlight: boolean };

/** Découpe un titre : la partie entre *astérisques* est mise en valeur. */
export function titleParts(title: string): Part[] {
  return frenchSpacing(title)
    .split(/(\*[^*]+\*)/)
    .filter(Boolean)
    .map((chunk) => (chunk.startsWith("*") && chunk.endsWith("*") ? { text: chunk.slice(1, -1), highlight: true } : { text: chunk, highlight: false }));
}

/** Titre statique : partie mise en valeur en dégradé animé. */
export function Title({ title }: { title: string }) {
  return (
    <>
      {titleParts(title).map((part, i) =>
        part.highlight ? (
          <span key={i} className="sd-gtext">{part.text}</span>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Titre de hero : chaque mot apparaît à son tour (flou → net), la partie
 * mise en valeur en dernier. `breakLine` la place sur sa propre ligne. */
export function AnimatedTitle({ title, start, step, highlightDelay, breakLine = false }: { title: string; start: number; step: number; highlightDelay?: number; breakLine?: boolean }) {
  const parts = titleParts(title);
  let delay = start;
  const words = (text: string) =>
    text
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word, i, all) => {
        const node = (
          <Fragment key={`${word}-${delay}`}>
            <span className="sd-bw" style={{ animationDelay: `${delay.toFixed(2)}s` }}>{word}</span>
            {i < all.length - 1 && " "}
          </Fragment>
        );
        delay += step;
        return node;
      });

  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (!part.highlight) {
      const content = words(part.text);
      if (!content.length) return;
      nodes.push(breakLine ? <span key={i} style={{ display: "block" }}>{content}</span> : <Fragment key={i}>{content}{" "}</Fragment>);
      return;
    }
    const d = highlightDelay ?? delay;
    delay = d + step;
    const highlighted = (
      <span className="sd-bw" style={{ animationDelay: `${d.toFixed(2)}s` }}>
        <span className="sd-gtext">{part.text}</span>
      </span>
    );
    nodes.push(breakLine ? <span key={i} style={{ display: "block", paddingBottom: "0.06em" }}>{highlighted}</span> : <Fragment key={i}>{highlighted}{" "}</Fragment>);
  });
  return <>{nodes}</>;
}
