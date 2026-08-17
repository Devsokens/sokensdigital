/** Mirrors backend/core/constants.py's MODULES/MODULE_ACTIONS — keys must
 * match exactly, since Role.permissions (stored backend-side) is keyed by
 * these module ids. Used by the Utilisateurs & Rôles permission editor. */
export const MODULE_ACTIONS = ["voir", "creer", "modifier", "supprimer"] as const;
export type ModuleAction = (typeof MODULE_ACTIONS)[number];

export const ACTION_LABELS: Record<ModuleAction, string> = {
  voir: "Voir",
  creer: "Créer",
  modifier: "Modifier",
  supprimer: "Supprimer",
};

export interface PermissionModule {
  key: string;
  label: string;
  section: string;
}

export const PERMISSION_MODULES: PermissionModule[] = [
  { key: "dashboard", label: "Tableau de bord", section: "Général" },
  { key: "messagerie", label: "Messagerie", section: "Général" },
  { key: "rh-dashboard", label: "Tableau de bord RH", section: "Administration & RH" },
  { key: "employes", label: "Employés", section: "Administration & RH" },
  { key: "departements", label: "Départements", section: "Administration & RH" },
  { key: "clients", label: "Clients", section: "Administration & RH" },
  { key: "utilisateurs", label: "Utilisateurs & Rôles", section: "Administration & RH" },
  { key: "audit-log", label: "Audit Log", section: "Administration & RH" },
  { key: "marketing-dashboard", label: "Dashboard Marketing", section: "Marketing & Commercial" },
  { key: "contenu", label: "Gestion de contenu", section: "Marketing & Commercial" },
  { key: "plan-editorial", label: "Plan Éditorial", section: "Marketing & Commercial" },
  { key: "leads", label: "Tunnel commercial", section: "Marketing & Commercial" },
  { key: "devis", label: "Devis", section: "Marketing & Commercial" },
  { key: "projets", label: "Gestion de projet", section: "Technique" },
  { key: "timesheets", label: "Timesheets", section: "Technique" },
  { key: "decaissements", label: "Décaissements", section: "Technique" },
  { key: "cahier-des-charges", label: "Cahier des charges", section: "Technique" },
  { key: "finance-dashboard", label: "Analytique", section: "Finance & Comptabilité" },
  { key: "cloture", label: "Clôture comptable", section: "Finance & Comptabilité" },
  { key: "grand-livre", label: "Grand Livre", section: "Finance & Comptabilité" },
  { key: "facturation", label: "Facturation", section: "Finance & Comptabilité" },
  { key: "rapprochement", label: "Rapprochement bancaire", section: "Finance & Comptabilité" },
  { key: "tva", label: "Fiscalité (TVA)", section: "Finance & Comptabilité" },
  { key: "achats", label: "Opérations d'achats", section: "Finance & Comptabilité" },
  { key: "tresorerie", label: "Trésorerie (caisse & banque)", section: "Finance & Comptabilité" },
  { key: "tickets", label: "Tickets", section: "Support Client" },
  { key: "base-connaissances", label: "Base de connaissances", section: "Support Client" },
  { key: "parametres", label: "Paramètres", section: "Paramètres" },
];
