"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { useProfileModal } from "@/lib/admin/profile-modal-context";
import { usePermissions } from "@/lib/admin/permissions-context";
import { ADMIN_SECTIONS, SECTION_ICONS, findNavMatch, filterSectionsByAccess } from "@/lib/admin-nav";

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export function AdminSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { openProfileModal } = useProfileModal();
  const { canAccessModule } = usePermissions();
  const allowedSections = filterSectionsByAccess(ADMIN_SECTIONS, canAccessModule);
  // Same department the DepartmentRail highlights, derived from the URL —
  // the two can never disagree about which department is "current",
  // regardless of how the user got to this page.
  const match = findNavMatch(pathname, allowedSections);
  const activeSection = match?.section.title ?? null;
  // The single best-matching item's href (longest-prefix match across ALL
  // sections) — NOT recomputed per-item below, because a naive per-item
  // `pathname.startsWith(item.href + "/")` check lights up every sibling
  // whose href happens to be a prefix of another (e.g. "Employés"
  // /admin/rh is a prefix of "Départements" /admin/rh/departements, so
  // both used to show active at once).
  const activeItemHref = match?.item.href ?? null;
  const visibleSections = activeSection
    ? allowedSections.filter((section) => section.title === activeSection)
    : allowedSections;
  const HeaderIcon = activeSection ? SECTION_ICONS[activeSection] : null;
  const headerMeta = activeSection
    ? `${visibleSections[0]?.items.length ?? 0} module${(visibleSections[0]?.items.length ?? 0) > 1 ? "s" : ""}`
    : `${allowedSections.length} départements`;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-20 z-40 hidden flex-col overflow-hidden border-white/10 bg-background/95 backdrop-blur-md transition-[width] duration-200 lg:flex",
        collapsed ? "w-0 border-r-0" : "w-52 border-r"
      )}
    >
      <div className="flex w-52 shrink-0 items-center gap-2.5 px-5 py-6">
        {HeaderIcon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HeaderIcon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {activeSection ?? "Tous les modules"}
          </p>
          <p className="truncate text-xs text-muted-foreground">{headerMeta}</p>
        </div>
      </div>

      <nav data-tour="sidebar-nav" className="w-52 shrink-0 flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {visibleSections.map((section) => (
          <div key={section.title}>
            {!activeSection && (
              <p className="mb-2 px-2.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item, index) => {
                const isActive = item.href === activeItemHref;
                const Icon = item.icon;
                // Sous-en-tête de groupe (ex: "RH" dans "Administration") —
                // affiché juste avant le premier item d'un nouveau group,
                // jamais répété entre deux items du même group.
                const previousGroup = index > 0 ? section.items[index - 1].group : undefined;
                const showGroupHeading = item.group && item.group !== previousGroup;
                return (
                  <div key={item.href}>
                    {showGroupHeading && (
                      <p className="mb-1 mt-3 px-2.5 text-[0.6rem] font-semibold tracking-wider text-muted-foreground/50 uppercase first:mt-0">
                        {item.group}
                      </p>
                    )}
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                        item.group && "ml-1",
                        isActive
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-foreground/80 hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {profile && (
        <button
          type="button"
          onClick={openProfileModal}
          className="flex w-52 shrink-0 items-center gap-2.5 border-t border-white/10 px-5 py-3.5 text-left transition-colors hover:bg-white/5"
        >
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- Firebase Storage URL, not a local/optimizable asset
              <img src={profile.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              initials(profile.firstName, profile.lastName)
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              {profile.firstName} {profile.lastName}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{profile.role}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    </aside>
  );
}
