import { apiFetch } from "@/lib/api/client";
import type { Lead, Paginated } from "@/lib/api/types";

export function listLeads() {
  return apiFetch<Paginated<Lead>>("/api/v1/marketing/leads/");
}

export function updateLead(id: string, data: Partial<{
  status: string;
  qualification_score: number;
  assigned_to_id: string | null;
}>) {
  return apiFetch<Lead>(`/api/v1/marketing/leads/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
