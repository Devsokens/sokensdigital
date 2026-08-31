import { apiFetch } from "@/lib/api/client";
import type {
  MaintainedApp,
  MaintainedAppSecrets,
  MaintenanceReport,
  MaintenanceServiceAccount,
  Paginated,
} from "@/lib/api/types";

export function listMaintainedApps() {
  return apiFetch<Paginated<MaintainedApp>>("/api/technique/maintenance/apps/");
}

export type MaintainedAppInput = Partial<
  Pick<
    MaintainedApp,
    | "name" | "app_type" | "url" | "description" | "client" | "project"
    | "tech_stack" | "hosting_provider" | "repository_url" | "admin_url"
    | "maintenance_frequency" | "is_active"
  >
> & {
  /** Champs chiffrés au repos côté serveur — en écriture seule ici, ils ne
   * reviennent jamais dans la réponse d'un GET de liste ou de détail. */
  admin_username?: string;
  admin_password?: string;
  access_notes?: string;
};

export function createMaintainedApp(data: MaintainedAppInput) {
  return apiFetch<MaintainedApp>("/api/technique/maintenance/apps/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateMaintainedApp(id: string, data: MaintainedAppInput) {
  return apiFetch<MaintainedApp>(`/api/technique/maintenance/apps/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/** Consultation journalisée côté serveur — n'appeler qu'à la demande
 * explicite de l'utilisateur, jamais au chargement d'une liste. */
export function getMaintainedAppSecrets(id: string) {
  return apiFetch<MaintainedAppSecrets>(`/api/technique/maintenance/apps/${id}/secrets/`);
}

export function assignMaintainedApp(id: string, userId: string) {
  return apiFetch<MaintainedApp>(`/api/technique/maintenance/apps/${id}/assign/`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export function listMaintenanceReports(appId?: string) {
  const qs = appId ? `?app=${appId}` : "";
  return apiFetch<Paginated<MaintenanceReport>>(`/api/technique/maintenance/reports/${qs}`);
}

export type MaintenanceReportInput = Pick<
  MaintenanceReport,
  "app" | "status" | "site_reachable" | "backups_verified" | "updates_applied" | "ssl_valid" | "summary"
> & { next_actions?: string };

export function createMaintenanceReport(data: MaintenanceReportInput) {
  return apiFetch<MaintenanceReport>("/api/technique/maintenance/reports/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function createServiceAccount(data: {
  app: string;
  service_name: string;
  url?: string;
  username?: string;
  password?: string;
  notes?: string;
}) {
  return apiFetch<MaintenanceServiceAccount>("/api/technique/maintenance/service-accounts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
