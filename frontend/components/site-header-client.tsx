"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SiteNavLink } from "@/lib/api/types";

type Props = {
  navLinks: SiteNavLink[];
  logoUrl?: string;
};

export function SiteHeaderClient({ navLinks, logoUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 24);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 sm:px-6 lg:px-8">
      <div
        className={cn(
          "mx-auto flex items-center justify-between transition-all duration-500 ease-out",
          scrolled
            ? "mt-3 max-w-4xl rounded-full border border-white/10 bg-background/80 px-4 py-2 shadow-lg shadow-black/30 backdrop-blur-md"
            : "mt-0 max-w-7xl rounded-none border border-transparent bg-transparent px-0 py-4 shadow-none backdrop-blur-none"
        )}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image
            src={logoUrl || "/assets/logo-sokens-digital-white.png"}
            alt="Soken's Digital"
            width={319}
            height={89}
            priority
            unoptimized={Boolean(logoUrl)}
            className={cn(
              "w-auto transition-all duration-500",
              scrolled ? "h-6" : "h-7 sm:h-8"
            )}
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => {
            const isActive =
              link.href.startsWith("/") &&
              (pathname === link.href || pathname.startsWith(`${link.href}/`));
            return (
              <a
                key={link.label}
                href={link.href}
                className={cn(
                  "relative py-1 text-sm transition-colors hover:text-primary",
                  isActive ? "text-foreground" : "text-foreground/90"
                )}
              >
                {link.label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-1 h-px bg-primary" />
                )}
              </a>
            );
          })}
        </nav>

        <div className="hidden md:block">
          <Button
            render={<a href="/demarrer-un-projet">Démarrer un Projet</a>}
            nativeButton={false}
            size={scrolled ? "sm" : "default"}
            className="rounded-full bg-primary px-5 text-xs font-semibold tracking-wide text-primary-foreground uppercase transition-all duration-500 hover:bg-primary/90"
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center justify-center rounded-md p-2 text-foreground md:hidden"
          aria-label="Ouvrir le menu"
          aria-expanded={open}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {open && (
        <div className="mx-auto mt-2 max-w-4xl rounded-2xl border border-white/10 bg-background shadow-lg md:hidden">
          <nav className="flex flex-col gap-1 p-3">
            {navLinks.map((link) => {
              const isActive =
              link.href.startsWith("/") &&
              (pathname === link.href || pathname.startsWith(`${link.href}/`));
              return (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-white/5 hover:text-primary",
                    isActive ? "bg-white/5 text-primary" : "text-foreground/90"
                  )}
                >
                  {link.label}
                </a>
              );
            })}
            <Button
              render={
                <a href="/demarrer-un-projet" onClick={() => setOpen(false)}>
                  Démarrer un Projet
                </a>
              }
              nativeButton={false}
              className="mt-2 w-full rounded-full bg-primary text-xs font-semibold tracking-wide text-primary-foreground uppercase hover:bg-primary/90"
            />
          </nav>
        </div>
      )}
    </header>
  );
}
