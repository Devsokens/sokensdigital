import { apiFetch } from "@/lib/api/client";
import type { Paginated, Project, ProjectMember, Timesheet } from "@/lib/api/types";

export function listProjects() {
  return apiFetch<Paginated<Project>>("/api/v1/projects/");
}

export function getProject(id: string) {
  return apiFetch<Project>(`/api/v1/projects/${id}/`);
}

export function createProject(data: {
  name: string;
  start_date?: string;
  end_date?: string;
  budget?: string;
  lead_project_manager_id?: string;
}) {
  return apiFetch<Project>("/api/v1/projects/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProject(id: string, data: Partial<{
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  budget: string;
}>) {
  return apiFetch<Project>(`/api/v1/projects/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProject(id: string) {
  return apiFetch<void>(`/api/v1/projects/${id}/`, { method: "DELETE" });
}

export function addProjectMember(projectId: string, userId: string) {
  return apiFetch<ProjectMember>(`/api/v1/projects/${projectId}/members/`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export function removeProjectMember(projectId: string, membershipId: string) {
  return apiFetch<void>(`/api/v1/projects/${projectId}/members/${membershipId}/`, { method: "DELETE" });
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
