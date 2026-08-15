import { apiFetch } from "@/lib/api/client";
import type {
  Paginated,
  Project,
  ProjectMember,
  ProjectTask,
  ProjectTaskComment,
  ProjectTaskStatus,
  TeamTimesheetResponse,
  Timesheet,
} from "@/lib/api/types";

export function listProjects(params?: { search?: string }) {
  const query = params?.search ? `?search=${encodeURIComponent(params.search)}` : "";
  return apiFetch<Paginated<Project>>(`/api/v1/projects/${query}`);
}

export function getProject(id: string) {
  return apiFetch<Project>(`/api/v1/projects/${id}/`);
}

export function createProject(data: {
  name: string;
  start_date?: string;
  end_date?: string;
  budget?: string;
  priority?: string;
  category?: string;
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
  priority: string;
  category: string;
  start_date: string;
  end_date: string;
  budget: string;
  is_archived: boolean;
  is_locked: boolean;
}>) {
  return apiFetch<Project>(`/api/v1/projects/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProject(id: string) {
  return apiFetch<void>(`/api/v1/projects/${id}/`, { method: "DELETE" });
}

export function toggleProjectPin(id: string) {
  return apiFetch<{ is_pinned: boolean }>(`/api/v1/projects/${id}/pin/`, { method: "POST" });
}

export function listProjectTasks(projectId: string) {
  return apiFetch<ProjectTask[]>(`/api/v1/projects/${projectId}/tasks/`);
}

export function createProjectTask(projectId: string, data: {
  title: string;
  status?: ProjectTaskStatus;
  due_date?: string;
  progress?: number;
  assignee_ids?: string[];
}) {
  return apiFetch<ProjectTask>(`/api/v1/projects/${projectId}/tasks/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProjectTask(projectId: string, taskId: string, data: Partial<{
  title: string;
  status: ProjectTaskStatus;
  due_date: string | null;
  progress: number;
  assignee_ids: string[];
}>) {
  return apiFetch<ProjectTask>(`/api/v1/projects/${projectId}/tasks/${taskId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProjectTask(projectId: string, taskId: string) {
  return apiFetch<void>(`/api/v1/projects/${projectId}/tasks/${taskId}/`, { method: "DELETE" });
}

export function listTaskComments(projectId: string, taskId: string) {
  return apiFetch<ProjectTaskComment[]>(`/api/v1/projects/${projectId}/tasks/${taskId}/comments/`);
}

export function createTaskComment(projectId: string, taskId: string, body: string) {
  return apiFetch<ProjectTaskComment>(`/api/v1/projects/${projectId}/tasks/${taskId}/comments/`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
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

export function submitTimesheet(projectId: string, data: { date: string; hours: string; description?: string; task_id?: string }) {
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

export function getTeamTimesheet(weekStart?: string) {
  const query = weekStart ? `?week_start=${weekStart}` : "";
  return apiFetch<TeamTimesheetResponse>(`/api/v1/projects/timesheets/team/${query}`);
}

export function setTeamTimesheetDayStatus(userId: string, date: string, status: "VALIDE" | "REJETE") {
  return apiFetch<{ updated: number }>(`/api/v1/projects/timesheets/team/day-status/`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, date, status }),
  });
}
