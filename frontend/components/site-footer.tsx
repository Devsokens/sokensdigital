import Image from "next/image";
import Link from "next/link";
import { getSiteSettings } from "@/lib/api/public";
import { NAV_LINKS } from "@/lib/site-nav";
import { SectionIcon } from "@/components/dynamic-icon";

export async function SiteFooter() {
  const settings = await getSiteSettings();

  return (
    <footer className="border-t border-white/10 bg-white/[0.02]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link href="/connexion" className="inline-block">
              <Image
                src={settings.logo_url || "/assets/logo-sokens-digital-white.png"}
                alt="Soken's Digital"
                width={319}
                height={89}
                unoptimized={Boolean(settings.logo_url)}
                className="h-7 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {settings.tagline}
            </p>
            <div className="mt-5 flex items-center gap-3">
              {settings.social_links.map((social) => (
                <a
                  key={social.url}
                  href={social.url}
                  aria-label={social.icon}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <SectionIcon name={social.icon} className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-[0.15em] text-foreground uppercase">
              Services
            </h3>
            <ul className="mt-4 space-y-3">
              {settings.services_links.map((service) => (
                <li key={service.label}>
                  <a
                    href="#expertise"
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {service.label}
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
              {settings.legal_links.map((link) => (
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
          <p>{settings.copyright_text}</p>
          <p className="inline-flex items-center gap-2 tracking-[0.05em] uppercase">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Tous les systèmes sont opérationnels
          </p>
        </div>
      </div>
    </footer>
  );
}
