import Image from "next/image";
import { Globe, AtSign } from "lucide-react";

const SERVICES_LINKS = [
  "Logiciel client",
  "App Web & Mobile",
  "Digitalisation",
  "Audit & Sécurité",
];

const NAV_LINKS = [
  { label: "Expertise", href: "/expertise" },
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "#contact" },
];

const LEGAL_LINKS = [
  { label: "Politique de confidentialité", href: "#" },
  { label: "Condition d'utilisation", href: "#" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Image
              src="/assets/logo-sokens-digital-white.png"
              alt="Soken's Digital"
              width={319}
              height={89}
              className="h-7 w-auto"
            />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Architectes de solutions numériques haute performance.
              Sécurité. Précision. Innovation.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <a
                href="#"
                aria-label="Site web"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Globe className="size-4" />
              </a>
              <a
                href="mailto:contact@sokensdigital.com"
                aria-label="Email"
                className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
              >
                <AtSign className="size-4" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">
              Services
            </h3>
            <ul className="mt-4 space-y-3">
              {SERVICES_LINKS.map((label) => (
                <li key={label}>
                  <a
                    href="#expertise"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">
              Navigation
            </h3>
            <ul className="mt-4 space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">
              Légal
            </h3>
            <ul className="mt-4 space-y-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="/suivi-projet"
                  className="inline-block rounded-md border border-white/15 px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  Suivre un projet
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>&copy; 2024 Soken&apos;s Digital. Sécurité. Précision. Haute Performance.</p>
          <p className="inline-flex items-center gap-2 tracking-[0.05em] uppercase">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Tous les systèmes sont opérationnels
          </p>
        </div>
      </div>
    </footer>
  );
}
