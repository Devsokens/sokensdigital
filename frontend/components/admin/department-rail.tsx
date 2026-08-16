"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_SECTIONS, SECTION_ICONS, SECTION_SHORT_LABELS, findNavMatch, filterSectionsByAccess } from "@/lib/admin-nav";
import { usePermissions } from "@/lib/admin/permissions-context";
import { cn } from "@/lib/utils";

/** Canva-style icon-only primary rail: one column, one department per row
 * (icon + tiny label), always visible on desktop. The active department is
 * derived straight from the current pathname (same helper the mobile bottom
 * nav already uses) rather than tracked in separate state — so it can never
 * drift out of sync with a direct link, a back/forward navigation, or any
 * other way of landing on a page besides clicking a rail icon. Clicking a
 * department jumps to its first module; the wider AdminSidebar reads the
 * same pathname-derived value to show only that department's items. */
export function DepartmentRail() {
  const pathname = usePathname();
  const router = useRouter();
  const { canAccessModule } = usePermissions();
  const sections = filterSectionsByAccess(ADMIN_SECTIONS, canAccessModule);
  const activeSectionTitle = findNavMatch(pathname, sections)?.section.title ?? null;

  return (
    <aside
      data-tour="department-switcher"
      className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center border-r border-white/10 bg-background/95 py-5 backdrop-blur-md lg:flex"
    >
      <Link
        href="/admin"
        aria-label="Accueil"
        className="mb-6 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground"
      >
        SD
      </Link>

      <nav className="flex flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {sections.map((section) => {
          const Icon = SECTION_ICONS[section.title];
          const isActive = activeSectionTitle === section.title;
          return (
            <button
              key={section.title}
              type="button"
              onClick={() => router.push(section.items[0].href)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-2.5 transition-colors",
                isActive ? "bg-primary/15 text-primary" : "text-foreground/60 hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <span className="w-full truncate text-center text-[0.62rem] leading-none font-medium">
                {SECTION_SHORT_LABELS[section.title]}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
