"use client";

import { createContext, useContext, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { Section } from "./cms";

/* Édition visuelle de la vitrine depuis l'admin (façon WordPress). Les
 * composants du site enveloppent leurs textes, liens et images dans
 * <Editable> ; sans éditeur autour (site public), ces enveloppes rendent
 * simplement leur contenu. L'éditeur (components/admin/marketing/
 * vitrine-editor.tsx) fournit le contexte : clic → fenêtre de modification
 * → enregistrement dans le CMS. */

export type EditKind = "text" | "textarea" | "link" | "image" | "list" | "icon";

export type LinkValue = { label: string; href: string };

export type SettingsKey = "tagline" | "contact_email" | "contact_phone" | "copyright_text" | "logo_url";

export type EditPath =
  | { scope: "field"; field: "kicker" | "title" | "subtitle" | "cta" | "ctaSecondary" }
  | { scope: "item"; index: number; key: string; hrefKey?: string }
  | { scope: "extra"; key: string }
  | { scope: "settings"; key: SettingsKey }
  | { scope: "legal"; index: number }
  /** Champ d'un projet vitrine (page de détail) ; `index` pour une image de la galerie. */
  | { scope: "project"; key: string; index?: number };

export type EditRequest = {
  section?: Section;
  path: EditPath;
  kind: EditKind;
  /** Repère affiché en petit dans la fenêtre (« hero.title »). */
  label: string;
  value: string | string[] | LinkValue;
  hint?: string;
};

export type EditContextValue = {
  open: (request: EditRequest) => void;
  setItems: (section: Section, items: Record<string, unknown>[]) => void;
  toggleSection: (section: Section) => void;
  setLegalLinks: (links: LinkValue[]) => void;
  legalLinks: LinkValue[];
};

export const EditContext = createContext<EditContextValue | null>(null);

export function useEditor() {
  return useContext(EditContext);
}

function pathLabel(path: EditPath) {
  switch (path.scope) {
    case "field":
      return path.field;
    case "item":
      return `${path.index + 1}.${path.key}`;
    case "extra":
      return path.key;
    case "settings":
      return path.key;
    case "legal":
      return `liens_legaux.${path.index + 1}`;
    case "project":
      return path.index === undefined ? path.key : `${path.key}.${path.index + 1}`;
  }
}

/** Texte, lien ou image modifiable au clic dans l'éditeur. */
export function Editable({ section, path, kind = "text", value, hint, children }: { section?: Section; path: EditPath; kind?: EditKind; value: EditRequest["value"]; hint?: string; children: ReactNode }) {
  const editor = useContext(EditContext);
  if (!editor) return <>{children}</>;

  const open = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();
    editor.open({ section, path, kind, value, hint, label: `${path.scope === "project" ? "projet" : section?.key ?? "site"}.${pathLabel(path)}` });
  };
  return (
    <span className="sd-editable" role="button" tabIndex={0} title="Cliquer pour modifier" onClick={open} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(e)}>
      {children}
    </span>
  );
}

/** Cadre d'une section dans l'éditeur : nom, bouton Masquer / Afficher
 * (`canHide={false}` pour une section indispensable à la page). */
export function EditableSection({ section, name, canHide = true, children }: { section: Section; name: string; canHide?: boolean; children: ReactNode }) {
  const editor = useContext(EditContext);
  if (!editor) return <>{children}</>;
  return (
    <div className="sd-edit-section" data-hidden={section.isActive ? undefined : "true"}>
      <div className="sd-edit-badge">
        <span>{name}</span>
        {!section.isActive && <span className="sd-edit-muted">Masquée sur le site</span>}
        {section.id && canHide && (
          <button type="button" onClick={() => editor.toggleSection(section)}>
            {section.isActive ? "Masquer" : "Afficher"}
          </button>
        )}
      </div>
      <div className="sd-edit-body">{children}</div>
    </div>
  );
}

/** Boutons monter / descendre / supprimer d'un élément de liste (services,
 * membres, chiffres…). Le parent doit être positionné (position: relative). */
export function ItemTools({ section, index }: { section: Section; index: number }) {
  const editor = useContext(EditContext);
  if (!editor) return null;
  const items = section.items;
  const move = (to: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    editor.setItems(section, next);
  };
  const stop = (fn: () => void) => (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    fn();
  };
  return (
    <span className="sd-item-tools">
      {index > 0 && <button type="button" title="Monter" onClick={stop(() => move(index - 1))}>↑</button>}
      {index < items.length - 1 && <button type="button" title="Descendre" onClick={stop(() => move(index + 1))}>↓</button>}
      <button type="button" title="Supprimer" onClick={stop(() => window.confirm("Supprimer cet élément ?") && editor.setItems(section, items.filter((_, i) => i !== index)))}>✕</button>
    </span>
  );
}

/** Bouton « Ajouter » en fin de liste, visible seulement dans l'éditeur. */
export function AddItem({ section, template, label, style }: { section: Section; template: Record<string, unknown>; label: string; style?: React.CSSProperties }) {
  const editor = useContext(EditContext);
  if (!editor) return null;
  return (
    <button type="button" className="sd-add-item" style={style} onClick={() => editor.setItems(section, [...section.items, template])}>
      + {label}
    </button>
  );
}

/** Bloc dont le contenu se gère ailleurs dans l'admin (projets, articles). */
export function ManagedElsewhere({ label, children }: { label: string; children: ReactNode }) {
  const editor = useContext(EditContext);
  if (!editor) return <>{children}</>;
  return (
    <div className="sd-managed">
      <span className="sd-managed-note">{label}</span>
      {children}
    </div>
  );
}
