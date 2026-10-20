"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Editable } from "./editable";
import { vitrineRootClass } from "./fonts";
import { CallButton } from "./call-button";
import { HEADER_HEIGHT, SiteLogo } from "./ui";

const NAV = [
  { label: "Accueil", href: "/" },
  { label: "Expertise", href: "/expertise" },
  { label: "Projets", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** `previewPath` : dans l'éditeur de l'admin, page dont le lien est affiché comme actif. */
export function VitrineHeader({ logoUrl, phone, previewPath }: { logoUrl?: string; phone: string; previewPath?: string }) {
  const currentPath = usePathname();
  const pathname = previewPath ?? currentPath;
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Sur la page Contact, la maquette remplace le bouton « Démarrer un
  // projet » (qui y mène) par le numéro de téléphone.
  const onContact = pathname === "/contact";

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 8);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // En haut de page, l'en-tête est transparent et le hero passe dessous :
  // les deux ne font qu'un. Dès qu'on défile, il reprend son fond flouté
  // pour rester lisible par-dessus le contenu.
  const solid = scrolled || menuOpen;

  return (
    <header className={vitrineRootClass} style={{ position: "sticky", top: "0", zIndex: 60, backgroundColor: solid ? "oklch(var(--sd-bg) / 0.7)" : "transparent", backdropFilter: solid ? "blur(16px) saturate(140%)" : "none", WebkitBackdropFilter: solid ? "blur(16px) saturate(140%)" : "none", borderBottom: `1px solid ${solid ? "rgba(255,255,255,0.06)" : "transparent"}`, transition: "background-color .3s ease, border-color .3s ease, backdrop-filter .3s ease" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", height: `${HEADER_HEIGHT - 1}px`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
        <Link href="/" aria-label="Soken's Digital, accueil" style={{ display: "flex", alignItems: "center" }}>
          <Editable path={{ scope: "settings", key: "logo_url" }} kind="image" value={logoUrl ?? ""} hint="Logo blanc sur fond transparent. Laissez vide pour le logo par défaut du site.">
            <SiteLogo src={logoUrl} height={32} priority />
          </Editable>
        </Link>
        <nav aria-label="Navigation principale" className="sd-hide-sm" style={{ display: "flex", alignItems: "center", gap: "2px", padding: "4px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", fontSize: "14.5px" }}>
          {NAV.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link key={link.href} className="sd-nl" href={link.href} aria-current={active ? "page" : undefined} style={{ padding: "7px 16px", borderRadius: "999px", color: active ? "oklch(var(--sd-fg))" : "oklch(var(--sd-fg-3))", background: active ? "rgba(255,255,255,0.08)" : undefined }}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        {onContact ? (
          <CallButton phone={phone} size={44} className="sd-hide-sm" />
        ) : (
          <Link className="sd-shimmer sd-hide-sm" href="/contact" style={{ display: "inline-flex", alignItems: "center", height: "42px", padding: "0 18px", borderRadius: "10px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontWeight: 600, fontSize: "14.5px", whiteSpace: "nowrap" }}>
            Démarrer un projet
          </Link>
        )}
        <button type="button" className="sd-show-sm" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} style={{ width: "44px", height: "44px", alignItems: "center", justifyContent: "center", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "oklch(var(--sd-fg))", cursor: "pointer" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16" />
            <path d="M4 12h16" />
            <path d="M4 17h16" />
          </svg>
        </button>
      </div>
      {menuOpen && (
        <nav aria-label="Menu mobile" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px clamp(20px, 4vw, 40px) 20px", display: "flex", flexDirection: "column", background: "oklch(var(--sd-bg) / 0.97)" }}>
          {NAV.map((link, i) => (
            <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{ padding: "14px 4px", fontSize: "17px", color: isActive(pathname, link.href) ? "oklch(var(--sd-fg))" : "oklch(var(--sd-fg-2))", borderBottom: i < NAV.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
              {link.label}
            </Link>
          ))}
          {!onContact && (
            <Link className="sd-shimmer" href="/contact" onClick={() => setMenuOpen(false)} style={{ marginTop: "12px", height: "50px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "12px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontWeight: 600 }}>
              Démarrer un projet
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
