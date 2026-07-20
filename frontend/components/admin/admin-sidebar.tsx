"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  Wallet,
  Megaphone,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Général",
    items: [
      { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
      { label: "Mon profil", href: "/profil", icon: UserRound },
    ],
  },
  {
    title: "Administration & RH",
    items: [
      { label: "Employés", href: "/admin/rh", icon: Users },
      { label: "Départements", href: "/admin/rh/departements", icon: Building2 },
    ],
  },
  {
    title: "Technique",
    items: [{ label: "Projets", href: "/admin/projets", icon: FolderKanban, comingSoon: true }],
  },
  {
    title: "Comptabilité & Finance",
    items: [{ label: "Finance", href: "/admin/finance", icon: Wallet, comingSoon: true }],
  },
  {
    title: "Marketing & Commercial",
    items: [{ label: "Marketing", href: "/admin/marketing", icon: Megaphone, comingSoon: true }],
  },
  {
    title: "Collaboration",
    items: [{ label: "Messagerie", href: "/admin/chat", icon: MessageSquare, comingSoon: true }],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/10 bg-background/95 backdrop-blur-md lg:flex">
      <Link href="/" className="flex items-center gap-2 px-5 py-6">
        <Image
          src="/assets/logo-sokens-digital-white.png"
          alt="Soken's Digital"
          width={319}
          height={89}
          className="h-6 w-auto"
        />
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-2 px-2.5 text-[0.65rem] font-semibold tracking-wider text-muted-foreground/60 uppercase">
              {section.title}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                if (item.comingSoon) {
                  return (
                    <div
                      key={item.href}
                      className="flex cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-2 text-sm text-muted-foreground/40"
                    >
                      <span className="flex items-center gap-2.5">
                        <Icon className="size-4" />
                        {item.label}
                      </span>
                      <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[0.6rem]">
                        Bientôt
                      </span>
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
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
        <div className="border-t border-white/10 px-5 py-4">
          <p className="truncate text-sm font-medium text-foreground">
            {profile.firstName} {profile.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{profile.role}</p>
        </div>
      )}
    </aside>
  );
}
