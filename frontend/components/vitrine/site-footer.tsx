"use client";

import Image from "next/image";
import Link from "next/link";
import type { SiteSettings } from "@/lib/api/types";
import { Editable, useEditor } from "./editable";
import { vitrineRootClass } from "./fonts";
import { DEFAULT_LOGO, FONT_MONO, SiteLogo, contactInfo, telHref } from "./ui";

const NAV = [
  { label: "Accueil", href: "/" },
  { label: "Expertise", href: "/expertise" },
  { label: "Projets", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

const COLUMN_TITLE = { fontFamily: FONT_MONO, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: "oklch(var(--sd-fg-4))" } as const;

type FooterSettings = Pick<SiteSettings, "logo_url" | "tagline" | "contact_email" | "contact_phone" | "legal_links" | "copyright_text">;

/** Pied de page : contenu des paramètres du site (Header & Footer), modifiable
 * au clic dans l'éditeur. La navigation, elle, est fixe. */
export function VitrineFooter({ settings }: { settings: FooterSettings }) {
  const editor = useEditor();
  const { email, phone } = contactInfo(settings);
  const legal = editor ? editor.legalLinks : settings.legal_links;
  const copyright = settings.copyright_text.includes("©") ? settings.copyright_text : `© ${new Date().getFullYear()} ${settings.copyright_text}`;

  return (
    <footer className={vitrineRootClass} style={{ position: "relative", overflow: "hidden", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "64px 0 0", background: "oklch(var(--sd-bg-deep))", color: "oklch(var(--sd-fg))", fontFamily: "var(--font-geist), system-ui, -apple-system, 'Segoe UI', sans-serif", fontSize: "16px", lineHeight: 1.6, WebkitFontSmoothing: "antialiased" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "40px 64px" }}>
          <div style={{ flex: "1 1 300px", maxWidth: "380px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Le logo du pied de page reste l'accès discret à l'espace de connexion. */}
            <Link href="/connexion" style={{ display: "flex", alignItems: "center", alignSelf: "flex-start" }}>
              <SiteLogo src={settings.logo_url} height={30} />
            </Link>
            <p style={{ margin: "0", fontSize: "15px", color: "oklch(var(--sd-fg-3))" }}>
              <Editable path={{ scope: "settings", key: "tagline" }} kind="textarea" value={settings.tagline}>
                {settings.tagline}
              </Editable>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "14.5px" }}>
              <a className="sd-nl" href={`mailto:${email}`} style={{ color: "oklch(var(--sd-fg-2))" }}>
                <Editable path={{ scope: "settings", key: "contact_email" }} value={email}>
                  {email}
                </Editable>
              </a>
              <a className="sd-nl" href={telHref(phone)} style={{ color: "oklch(var(--sd-fg-2))" }}>
                <Editable path={{ scope: "settings", key: "contact_phone" }} value={phone}>
                  {phone}
                </Editable>{" "}
                · Libreville, Gabon
              </a>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "40px clamp(40px, 6vw, 88px)" }}>
            <nav aria-label="Navigation" style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14.5px" }}>
              <span style={COLUMN_TITLE}>Navigation</span>
              {NAV.map((link) => (
                <Link key={link.href} className="sd-nl" href={link.href} style={{ color: "oklch(var(--sd-fg-3))" }}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <nav aria-label="Légal" style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "14.5px" }}>
              <span style={COLUMN_TITLE}>Légal</span>
              {legal.map((link, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                  <Link className="sd-nl" href={link.href || "#"} style={{ color: "oklch(var(--sd-fg-3))" }}>
                    <Editable path={{ scope: "legal", index: i }} kind="link" value={{ label: link.label, href: link.href }}>
                      {link.label}
                    </Editable>
                  </Link>
                  {editor && (
                    <button type="button" className="sd-add-item" title="Supprimer ce lien" style={{ minHeight: "24px", padding: "0 8px", fontSize: "11px" }} onClick={() => window.confirm("Supprimer ce lien ?") && editor.setLegalLinks(legal.filter((_, j) => j !== i))}>
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {editor && (
                <button type="button" className="sd-add-item" style={{ minHeight: "32px", fontSize: "12.5px" }} onClick={() => editor.setLegalLinks([...legal, { label: "Nouveau lien", href: "/" }])}>
                  + Ajouter un lien
                </button>
              )}
            </nav>
          </div>
        </div>
        <div style={{ marginTop: "56px", padding: "22px 0", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px 24px", fontSize: "13.5px", color: "oklch(var(--sd-fg-4))" }}>
          <span>
            <Editable path={{ scope: "settings", key: "copyright_text" }} value={settings.copyright_text} hint="L'année est ajoutée automatiquement devant (sauf si le texte contient déjà ©).">
              {copyright}
            </Editable>
          </span>
        </div>
      </div>
      {/* Filigrane : le logo officiel en très grand, estompé vers le bas et
       * coupé par le bord de page, comme le mot « SOKEN'S » de la maquette. */}
      <div aria-hidden="true" style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", overflow: "hidden" }}>
        <Image src={DEFAULT_LOGO} alt="" width={319} height={89} style={{ display: "block", width: "min(100%, 920px)", height: "auto", margin: "0 auto -4%", opacity: 0.09, WebkitMaskImage: "linear-gradient(180deg, #000 20%, transparent 95%)", maskImage: "linear-gradient(180deg, #000 20%, transparent 95%)" }} />
      </div>
    </footer>
  );
}
