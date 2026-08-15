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
  FolderKanban,
  MessageSquare,
  Lock,
  BookOpen,
  Receipt,
  Landmark,
  Percent,
  PieChart,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Single source of truth for the sidebar AND the header's breadcrumb/quick
 * search — both need to know "which section + label does this URL belong
 * to", so it lives here instead of being duplicated. */
export const ADMIN_SECTIONS: NavSection[] = [
  {
    title: "Général",
    items: [
      { label: "Tableau de bord", href: "/admin", icon: LayoutDashboard },
      { label: "Messagerie", href: "/admin/messagerie", icon: MessageSquare },
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
      { label: "Gestion de projet", href: "/admin/technique/projets", icon: FolderKanban },
      { label: "Timesheets", href: "/admin/technique/timesheets", icon: Clock },
      { label: "Décaissements", href: "/admin/technique/decaissements", icon: Banknote },
    ],
  },
  {
    title: "Finance & Comptabilité",
    items: [
      { label: "Analytique", href: "/admin/finance/dashboard", icon: PieChart },
      { label: "Clôture comptable", href: "/admin/finance/cloture", icon: Lock },
      { label: "Grand Livre", href: "/admin/finance/grand-livre", icon: BookOpen },
      { label: "Facturation", href: "/admin/finance/facturation", icon: Receipt },
      { label: "Rapprochement bancaire", href: "/admin/finance/rapprochement", icon: Landmark },
      { label: "Fiscalité (TVA)", href: "/admin/finance/tva", icon: Percent },
    ],
  },
];

/** One representative icon per section — used by the header's department
 * switcher and the mobile bottom nav, which both need a single glyph per
 * department rather than the per-item icons above. */
export const SECTION_ICONS: Record<string, LucideIcon> = {
  "Général": LayoutDashboard,
  "Administration & RH": Users,
  "Marketing & Commercial": Target,
  "Technique": FolderKanban,
  "Finance & Comptabilité": PieChart,
};

/** Short, single-word labels for the mobile bottom nav — the full section
 * titles ("Administration & RH", "Finance & Comptabilité"...) don't fit
 * under a 5-column icon row without truncating illegibly. */
export const SECTION_SHORT_LABELS: Record<string, string> = {
  "Général": "Accueil",
  "Administration & RH": "RH",
  "Marketing & Commercial": "Marketing",
  "Technique": "Technique",
  "Finance & Comptabilité": "Finance",
};

/** Longest-prefix match — /admin/rh/departements should resolve to the
 * "Départements" item, not fall through to a shorter, unrelated prefix. */
export function findNavMatch(pathname: string): { section: NavSection; item: NavItem } | null {
  let best: { section: NavSection; item: NavItem } | null = null;
  for (const section of ADMIN_SECTIONS) {
    for (const item of section.items) {
      const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
      if (matches && (!best || item.href.length > best.item.href.length)) {
        best = { section, item };
      }
    }
  }
  return best;
}
