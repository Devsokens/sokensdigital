import {
  Banknote,
  BookOpen,
  Building2,
  CalendarClock,
  Clock,
  FileText,
  FolderKanban,
  Landmark,
  Lock,
  MessageSquare,
  Newspaper,
  Percent,
  Receipt,
  Target,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { AppRole } from "@/lib/firebase/types";

export interface QuickAction {
  label: string;
  icon: LucideIcon;
  /** Navigates to this route — mutually exclusive with `action`. */
  href?: string;
  /** Special-cased in MobileBottomNav instead of navigating — currently
   * only "open-profile" (the profile sheet has no route of its own). */
  action?: "open-profile";
}

/** Mobile FAB shortcuts — the 2-3 actions each role reaches for most often.
 * These navigate to the relevant module rather than opening its creation
 * form directly (no deep-link-opens-sheet mechanism exists yet); still a
 * meaningful shortcut since it skips hunting through the bottom nav. */
export const ROLE_QUICK_ACTIONS: Record<AppRole, QuickAction[]> = {
  SUPER_ADMIN: [
    { label: "Employé", href: "/admin/rh", icon: Users },
    { label: "Devis", href: "/admin/marketing/devis", icon: FileText },
    { label: "Projet", href: "/admin/technique/projets", icon: FolderKanban },
  ],
  RESPONSABLE_MARKETING: [
    { label: "Article", href: "/admin/marketing/blog", icon: Newspaper },
    { label: "Publication", href: "/admin/marketing/plan-editorial", icon: CalendarClock },
    { label: "Devis", href: "/admin/marketing/devis", icon: FileText },
  ],
  RESPONSABLE_RH: [
    { label: "Employé", href: "/admin/rh", icon: Users },
    { label: "Département", href: "/admin/rh/departements", icon: Building2 },
  ],
  COMMERCIAL: [
    { label: "Devis", href: "/admin/marketing/devis", icon: FileText },
    { label: "Leads", href: "/admin/marketing/leads", icon: Target },
  ],
  CHEF_DE_PROJET: [
    { label: "Projet", href: "/admin/technique/projets", icon: FolderKanban },
    { label: "Décaissement", href: "/admin/technique/decaissements", icon: Banknote },
    { label: "Heures", href: "/admin/technique/timesheets", icon: Clock },
  ],
  DEVELOPPEUR: [
    { label: "Heures", href: "/admin/technique/timesheets", icon: Clock },
    { label: "Projets", href: "/admin/technique/projets", icon: FolderKanban },
  ],
  COMPTABLE: [
    { label: "Écriture", href: "/admin/finance/grand-livre", icon: BookOpen },
    { label: "Facture", href: "/admin/finance/facturation", icon: Receipt },
  ],
  DIRECTEUR_FINANCIER: [
    { label: "Rapprochement", href: "/admin/finance/rapprochement", icon: Landmark },
    { label: "Clôture", href: "/admin/finance/cloture", icon: Lock },
    { label: "TVA", href: "/admin/finance/tva", icon: Percent },
  ],
  CAISSIER: [
    { label: "Caisse", href: "/admin/finance/tresorerie", icon: Wallet },
  ],
  AUTRE: [
    { label: "Messagerie", href: "/admin/messagerie", icon: MessageSquare },
    { label: "Profil", action: "open-profile", icon: UserRound },
  ],
};

/** Merges the quick actions of every role someone cumulates (décision du
 * 10/09/2026), de-duplicated by label (a Comptable+Caissier both list
 * distinct actions, but a shared one shouldn't show twice) and capped so
 * the FAB stays a shortcut, not a second nav menu. */
const MAX_QUICK_ACTIONS = 4;

export function quickActionsForRoles(roles: AppRole[]): QuickAction[] {
  const merged: QuickAction[] = [];
  const seen = new Set<string>();
  for (const role of roles.length > 0 ? roles : (["AUTRE"] as AppRole[])) {
    for (const action of ROLE_QUICK_ACTIONS[role] ?? []) {
      if (seen.has(action.label)) continue;
      seen.add(action.label);
      merged.push(action);
      if (merged.length >= MAX_QUICK_ACTIONS) return merged;
    }
  }
  return merged;
}
