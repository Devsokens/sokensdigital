"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { useProfileModal } from "@/lib/admin/profile-modal-context";
import { ADMIN_SECTIONS, SECTION_ICONS, findNavMatch } from "@/lib/admin-nav";

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export function AdminSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const { openProfileModal } = useProfileModal();
  // Same department the DepartmentRail highlights, derived from the URL —
  // the two can never disagree about which department is "current",
  // regardless of how the user got to this page.
  const activeSection = findNavMatch(pathname)?.section.title ?? null;
  const visibleSections = activeSection
    ? ADMIN_SECTIONS.filter((section) => section.title === activeSection)
    : ADMIN_SECTIONS;
  const HeaderIcon = activeSection ? SECTION_ICONS[activeSection] : null;
  const headerMeta = activeSection
    ? `${visibleSections[0]?.items.length ?? 0} module${(visibleSections[0]?.items.length ?? 0) > 1 ? "s" : ""}`
    : `${ADMIN_SECTIONS.length} départements`;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-20 z-40 hidden flex-col overflow-hidden border-white/10 bg-background/95 backdrop-blur-md transition-[width] duration-200 lg:flex",
        collapsed ? "w-0 border-r-0" : "w-64 border-r"
      )}
    >
      <div className="flex w-64 shrink-0 items-center gap-2.5 px-5 py-6">
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

      <nav data-tour="sidebar-nav" className="w-64 shrink-0 flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {visibleSections.map((section) => (
          <div key={section.title}>
            {!activeSection && (
              <p className="mb-2 px-2.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-foreground/80 hover:bg-white/5 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
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
          className="flex w-64 shrink-0 items-center gap-2.5 border-t border-white/10 px-5 py-3.5 text-left transition-colors hover:bg-white/5"
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
