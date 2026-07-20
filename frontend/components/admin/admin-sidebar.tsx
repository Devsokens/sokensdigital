"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  UserCog,
  ScrollText,
  Target,
  Newspaper,
  CalendarClock,
  FileText,
  Clock,
  Banknote,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
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
      { label: "Utilisateurs & Rôles", href: "/admin/rh/utilisateurs", icon: UserCog },
      { label: "Audit Log", href: "/admin/rh/audit-log", icon: ScrollText },
    ],
  },
  {
    title: "Marketing & Commercial",
    items: [
      { label: "Dashboard", href: "/admin/marketing/dashboard", icon: LayoutDashboard },
      { label: "Gestion de contenu", href: "/admin/marketing/blog", icon: Newspaper },
      { label: "Plan Éditorial", href: "/admin/marketing/plan-editorial", icon: CalendarClock },
      { label: "Tunnel commercial", href: "/admin/marketing/leads", icon: Target },
      { label: "Devis", href: "/admin/marketing/devis", icon: FileText },
    ],
  },
  {
    title: "Technique",
    items: [
      { label: "Timesheets", href: "/admin/technique/timesheets", icon: Clock },
      { label: "Décaissements", href: "/admin/technique/decaissements", icon: Banknote },
    ],
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
