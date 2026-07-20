import { apiFetch } from "@/lib/api/client";
import type { Paginated, Project, Timesheet } from "@/lib/api/types";

export function listProjects() {
  return apiFetch<Paginated<Project>>("/api/v1/projects/");
}

export function listTimesheets(projectId: string) {
  return apiFetch<Timesheet[]>(`/api/v1/projects/${projectId}/timesheets/`);
}

export function submitTimesheet(projectId: string, data: { date: string; hours: string; description?: string }) {
  return apiFetch<Timesheet>(`/api/v1/projects/${projectId}/timesheets/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function validateTimesheet(projectId: string, timesheetId: string, newStatus: "VALIDE" | "REJETE") {
  return apiFetch<Timesheet>(`/api/v1/projects/${projectId}/timesheets/${timesheetId}/validate/`, {
    method: "POST",
    body: JSON.stringify({ status: newStatus }),
  });
}
