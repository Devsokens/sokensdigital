"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/firebase/auth";
import { ROLE_LABELS } from "@/lib/firebase/types";

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Tableau de bord",
  "/admin/messagerie": "Messagerie",
  "/admin/rh": "Employés",
  "/admin/rh/departements": "Départements",
  "/admin/rh/utilisateurs": "Utilisateurs & Rôles",
  "/admin/rh/audit-log": "Audit Log",
  "/admin/marketing/dashboard": "Dashboard Marketing",
  "/admin/marketing/blog": "Gestion de contenu",
  "/admin/marketing/plan-editorial": "Plan Éditorial",
  "/admin/marketing/leads": "Tunnel commercial",
  "/admin/marketing/devis": "Devis",
  "/admin/technique/projets": "Gestion de projet",
  "/admin/technique/timesheets": "Timesheets",
  "/admin/technique/decaissements": "Décaissements",
  "/admin/finance/dashboard": "Analytique & Reporting",
  "/admin/finance/cloture": "Clôture comptable",
  "/admin/finance/grand-livre": "Grand Livre",
  "/admin/finance/facturation": "Facturation",
  "/admin/finance/rapprochement": "Rapprochement bancaire",
  "/admin/finance/tva": "Fiscalité (TVA)",
  "/profil": "Mon profil",
};

function pageTitleFor(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const prefixMatch = Object.keys(PAGE_TITLES)
    .filter((path) => path !== "/admin" && pathname.startsWith(path))
    .sort((a, b) => b.length - a.length)[0];
  return prefixMatch ? PAGE_TITLES[prefixMatch] : "Espace administrateur";
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export function AdminHeader() {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/80 px-6 backdrop-blur-md lg:pl-8">
      <div>
        <p className="text-base font-semibold text-neutral-900">{pageTitleFor(pathname)}</p>
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger className="relative flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900">
            <Bell className="size-[1.1rem]" />
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            </div>
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-neutral-400">
                Aucune notification pour l&apos;instant — le module Notifications (Firestore) arrive bientôt.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className="flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition-colors hover:bg-neutral-100">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(profile?.firstName, profile?.lastName)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-medium text-neutral-900">{profile?.firstName}</span>
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="truncate text-sm font-medium text-neutral-900">
                {profile?.firstName} {profile?.lastName}
              </p>
              <p className="truncate text-xs text-neutral-400">
                {profile ? ROLE_LABELS[profile.role] : ""}
              </p>
            </div>
            <div className="p-1.5">
              <Link
                href="/profil"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <UserRound className="size-4 text-neutral-400" /> Mon profil
              </Link>
              <button
                onClick={() => signOutUser()}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" /> Déconnexion
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
