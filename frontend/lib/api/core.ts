import { apiFetch } from "@/lib/api/client";
import type { GlobalDashboard } from "@/lib/api/types";

export function getGlobalDashboard() {
  return apiFetch<GlobalDashboard>("/api/v1/dashboard/");
}
