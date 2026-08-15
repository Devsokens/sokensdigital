import type { SpotlightPlacement } from "@/components/admin/spotlight-overlay";

export interface ModuleTourEntry {
  /** Unique key, also used as localStorage dedup key and as the
   * `data-tour="{targetId}"` attribute on the page's spotlighted element. */
  key: string;
  /** href prefix from ADMIN_SECTIONS this entry applies to. */
  route: string;
  title: string;
  description: string;
  placement: SpotlightPlacement;
}

/** One spotlight per module page, shown the first time a user opens it —
 * pointing at that page's single most useful action (its primary "Nouveau…"
 * button where one exists, otherwise the most useful thing to orient on).
 * Deliberately skips pages with no meaningful target yet (e.g. the mostly-
 * empty /admin dashboard greeting) rather than spotlighting something inert. */
export const MODULE_TOURS: ModuleTourEntry[] = [
  {
    key: "module-messagerie",
    route: "/admin/messagerie",
    title: "Vos salons de discussion",
    description: "Un salon Entreprise, un par département et un par projet — cliquez pour changer de conversation.",
    placement: "right",
  },
  {
    key: "module-rh-employes",
    route: "/admin/rh",
    title: "Ajouter un employé",
    description: "Ouvre un formulaire en plusieurs étapes pour créer un compte et un profil employé.",
    placement: "bottom-end",
  },
  {
    key: "module-rh-departements",
    route: "/admin/rh/departements",
    title: "Créer un département",
    description: "Les départements RH structurent vos équipes — un employé appartient à un seul département.",
    placement: "bottom-end",
  },
  {
    key: "module-rh-utilisateurs",
    route: "/admin/rh/utilisateurs",
    title: "Rôle & département",
    description: "Changez le rôle ou le département d'un utilisateur ici — cela détermine ce qu'il peut voir et faire.",
    placement: "bottom-start",
  },
  {
    key: "module-rh-audit",
    route: "/admin/rh/audit-log",
    title: "Journal immuable",
    description: "Chaque suppression d'un enregistrement est tracée ici automatiquement — lecture seule, rien à faire.",
    placement: "bottom-start",
  },
  {
    key: "module-marketing-dashboard",
    route: "/admin/marketing/dashboard",
    title: "Vue d'ensemble marketing",
    description: "Pipeline, leads et publications en un coup d'œil — ces cartes résument l'activité commerciale.",
    placement: "bottom-start",
  },
  {
    key: "module-marketing-blog",
    route: "/admin/marketing/blog",
    title: "Publier un article",
    description: "Crée un nouvel article de blog qui sera publié sur le site public.",
    placement: "bottom-end",
  },
  {
    key: "module-marketing-plan-editorial",
    route: "/admin/marketing/plan-editorial",
    title: "Planifier une publication",
    description: "Programme une publication réseaux sociaux — elle reste en brouillon jusqu'à validation.",
    placement: "bottom-end",
  },
  {
    key: "module-marketing-leads",
    route: "/admin/marketing/leads",
    title: "Faire avancer un lead",
    description: "Glissez une carte vers une autre colonne pour changer son statut dans le tunnel commercial.",
    placement: "bottom-start",
  },
  {
    key: "module-marketing-devis",
    route: "/admin/marketing/devis",
    title: "Créer un devis",
    description: "Crée un nouveau devis à envoyer à un client ou un prospect.",
    placement: "bottom-end",
  },
  {
    key: "module-technique-projets",
    route: "/admin/technique/projets",
    title: "Nouveau projet",
    description: "Crée un projet — vous en devenez automatiquement le chef.",
    placement: "bottom-end",
  },
  {
    key: "module-technique-timesheets",
    route: "/admin/technique/timesheets",
    title: "Saisir vos heures",
    description: "Enregistrez le temps passé sur un projet chaque jour.",
    placement: "bottom-end",
  },
  {
    key: "module-technique-decaissements",
    route: "/admin/technique/decaissements",
    title: "Demander un décaissement",
    description: "Soumettez une demande de dépense pour un projet dont vous êtes chef — elle suit un circuit de validation.",
    placement: "bottom-end",
  },
  {
    key: "module-finance-dashboard",
    route: "/admin/finance/dashboard",
    title: "Vos indicateurs clés",
    description: "Trésorerie, résultat brut et autres indicateurs financiers résumés en un coup d'œil.",
    placement: "bottom-start",
  },
  {
    key: "module-finance-cloture",
    route: "/admin/finance/cloture",
    title: "Ouvrir une période",
    description: "Créez une nouvelle période comptable à ouvrir, puis à clôturer une fois les écritures finalisées.",
    placement: "bottom-end",
  },
  {
    key: "module-finance-grand-livre",
    route: "/admin/finance/grand-livre",
    title: "Saisir une écriture",
    description: "Enregistrez une écriture comptable équilibrée (débit/crédit) sur une période ouverte.",
    placement: "bottom-end",
  },
  {
    key: "module-finance-facturation",
    route: "/admin/finance/facturation",
    title: "Créer une facture",
    description: "Ouvre une facture en brouillon, avant sa validation finale.",
    placement: "bottom-end",
  },
  {
    key: "module-finance-rapprochement",
    route: "/admin/finance/rapprochement",
    title: "Importer un relevé",
    description: "Importez un relevé bancaire pour ensuite lettrer ses transactions avec le Grand Livre.",
    placement: "bottom-end",
  },
  {
    key: "module-finance-tva",
    route: "/admin/finance/tva",
    title: "Générer une déclaration",
    description: "Génère une déclaration de TVA en brouillon à partir des écritures d'une période comptable.",
    placement: "bottom-end",
  },
];

/** Longest-prefix match, same principle as findNavMatch in admin-nav.ts. */
export function findModuleTour(pathname: string): ModuleTourEntry | null {
  let best: ModuleTourEntry | null = null;
  for (const entry of MODULE_TOURS) {
    const matches = pathname === entry.route || pathname.startsWith(`${entry.route}/`);
    if (matches && (!best || entry.route.length > best.route.length)) best = entry;
  }
  return best;
}
