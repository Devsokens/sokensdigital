import Image from "next/image";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/* Briques communes aux pages vitrine. Les styles sont repris tels quels de
 * la maquette (styles en ligne) ; les couleurs passent par la palette
 * --sd-* de vitrine.css. */

export const FONT_DISPLAY = "var(--font-bricolage), 'Segoe UI', sans-serif";
export const FONT_DISPLAY_SYS = "var(--font-bricolage), 'Segoe UI', system-ui, sans-serif";
export const FONT_MONO = "var(--font-geist-mono), ui-monospace, monospace";
export const FONT_MONO_MENLO = "var(--font-geist-mono), ui-monospace, Menlo, monospace";
export const FONT_SANS = "var(--font-geist), system-ui, -apple-system, 'Segoe UI', sans-serif";
export const FONT_SANS_SHORT = "var(--font-geist), system-ui, sans-serif";

export const CONTACT = {
  email: "contact@sokensdigital.com",
  phone: "060 00 13 33",
};

/** Coordonnées des paramètres du site, avec repli si un champ est vide. */
export function contactInfo(settings: { contact_email?: string; contact_phone?: string }) {
  return { email: settings.contact_email || CONTACT.email, phone: settings.contact_phone || CONTACT.phone };
}

/** Lien d'appel : les numéros nationaux gabonais reçoivent l'indicatif +241. */
export function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits.startsWith("+") ? digits : `+241${digits}`}`;
}

/** Hauteur de l'en-tête. Les heros remontent dessous (marge négative,
 * padding compensé) pour que leur fond continue derrière l'en-tête,
 * transparent en haut de page : les deux forment un seul bloc. Les décors
 * placés depuis le haut du hero sont décalés d'autant (`top + HEADER_HEIGHT`)
 * pour ne pas bouger à l'écran. */
export const HEADER_HEIGHT = 72;

export function underHeader(paddingTop: string, paddingBottom: string): CSSProperties {
  return {
    marginTop: `-${HEADER_HEIGHT}px`,
    paddingTop: `calc(${paddingTop} + ${HEADER_HEIGHT}px)`,
    paddingBottom,
  };
}

/** Titre de section (h2) commun à toutes les pages. */
export const H2_STYLE: CSSProperties = {
  margin: "16px 0 0",
  fontFamily: FONT_DISPLAY_SYS,
  fontWeight: 600,
  fontSize: "clamp(36px, 4.6vw, 60px)",
  lineHeight: 1.02,
  letterSpacing: "-0.035em",
};

export function Container({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", ...style }}>
      {children}
    </div>
  );
}

/** Sur-titre en mono capitales précédé d'un trait dégradé. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: "0", display: "inline-flex", alignItems: "center", gap: "12px", fontFamily: FONT_MONO_MENLO, fontSize: "12.5px", letterSpacing: "0.12em", textTransform: "uppercase", color: "oklch(var(--sd-primary-hi))" }}>
      <span style={{ width: "28px", height: "1px", background: "linear-gradient(90deg, transparent, oklch(var(--sd-primary)))" }} />
      {children}
    </p>
  );
}

/** Fil d'Ariane des pages intérieures (Accueil / Page). */
export function Breadcrumb({ current }: { current: string }) {
  return (
    <p className="sd-bw" style={{ margin: "0", display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: "oklch(var(--sd-fg-4))" }}>
      <Link className="sd-nl" href="/" style={{ color: "oklch(var(--sd-fg-4))" }}>
        Accueil
      </Link>
      <span aria-hidden="true">/</span>
      <span style={{ color: "oklch(var(--sd-fg-2))" }}>{current}</span>
    </p>
  );
}

export const DEFAULT_LOGO = "/assets/logo-sokens-digital-white.png";

/** Logo officiel (ordinateur + « SOKEN'S Digital »). `src` : logo envoyé
 * depuis le CMS (Header & Footer), sinon le fichier blanc du site. */
export function SiteLogo({ src, height, priority = false }: { src?: string; height: number; priority?: boolean }) {
  return (
    <Image
      src={src || DEFAULT_LOGO}
      alt="Soken's Digital"
      width={319}
      height={89}
      priority={priority}
      unoptimized={Boolean(src)}
      style={{ display: "block", width: "auto", height: `${height}px` }}
    />
  );
}

/** Icône seule du logo (l'ordinateur), pour les emplacements carrés. */
export function BrandMark({ width }: { width: number }) {
  return (
    <Image src="/assets/logo-sokens-digital-mark-white.png" alt="" aria-hidden="true" width={120} height={85} style={{ display: "block", width: `${width}px`, height: "auto" }} />
  );
}

export function ArrowIcon({ size }: { size: number }) {
  return (
    <svg className="sd-arr" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function PhoneIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
    </svg>
  );
}

export function CheckIcon({ size, strokeWidth, color = "currentColor" }: { size: number; strokeWidth: string; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Étincelle IA (badge du hero, cartes blog). */
export function SparkleIcon({ size, strokeWidth, stroke = "currentColor" }: { size: number; strokeWidth: string; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
      <path d="M19 17l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

/** Grille 11×11 du faux QR code (billet Workclass), identique à la maquette. */
export function buildQr(): string[] {
  const n = 11;
  const cells: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inFinder = (r < 3 && c < 3) || (r < 3 && c > n - 4) || (r > n - 4 && c < 3);
      const on = inFinder || (r * 7 + c * 13 + r * c) % 5 < 2;
      cells.push(on ? "#0B1314" : "transparent");
    }
  }
  return cells;
}
