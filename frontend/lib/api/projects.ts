import { auth } from "@/lib/firebase/config";
import { apiFetch } from "@/lib/api/client";
import type {
  Paginated,
  Project,
  ProjectDocument,
  ProjectMember,
  ProjectTask,
  ProjectTaskComment,
  ProjectTaskStatus,
  TeamTimesheetResponse,
  Timesheet,
} from "@/lib/api/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// backend/projects/models.py::ProjectTask.Status est en français
// (A_FAIRE/EN_COURS/EN_REVISION/TERMINE) ; le board (project-task-board.tsx)
// utilise des libellés anglais (ProjectTaskStatus). Sans cette conversion,
// chaque création/mise à jour de tâche envoyait un statut ("TODO"...) que le
// serializer Django rejette (pas une valeur valide du champ), donc la tâche
// n'était jamais créée.
const STATUS_TO_BACKEND: Record<ProjectTaskStatus, string> = {
  TODO: "A_FAIRE",
  IN_PROGRESS: "EN_COURS",
  IN_REVIEW: "EN_REVISION",
  DONE: "TERMINE",
};
const STATUS_FROM_BACKEND: Record<string, ProjectTaskStatus> = {
  A_FAIRE: "TODO",
  EN_COURS: "IN_PROGRESS",
  EN_REVISION: "IN_REVIEW",
  TERMINE: "DONE",
};

function taskFromBackend(task: ProjectTask): ProjectTask {
  return { ...task, status: STATUS_FROM_BACKEND[task.status as unknown as string] ?? task.status };
}

export function listProjects(params?: { search?: string }) {
  const query = params?.search ? `?search=${encodeURIComponent(params.search)}` : "";
  return apiFetch<Paginated<Project>>(`/api/v1/projects/${query}`);
}

export function getProject(id: string) {
  return apiFetch<Project>(`/api/v1/projects/${id}/`);
}

export interface ProjectInput {
  name: string;
  description?: string;
  cover_image_url?: string;
  start_date?: string;
  end_date?: string;
  budget?: string;
  priority?: string;
  category?: string;
  lead_project_manager_id?: string;
}

export function createProject(data: ProjectInput) {
  return apiFetch<Project>("/api/v1/projects/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProject(id: string, data: Partial<ProjectInput & {
  status: string;
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

export async function listProjectTasks(projectId: string) {
  const tasks = await apiFetch<ProjectTask[]>(`/api/v1/projects/${projectId}/tasks/`);
  return tasks.map(taskFromBackend);
}

export async function createProjectTask(projectId: string, data: {
  title: string;
  description?: string;
  status?: ProjectTaskStatus;
  due_date?: string;
  progress?: number;
  assignee_ids?: string[];
}) {
  const task = await apiFetch<ProjectTask>(`/api/v1/projects/${projectId}/tasks/`, {
    method: "POST",
    body: JSON.stringify({ ...data, status: data.status ? STATUS_TO_BACKEND[data.status] : undefined }),
  });
  return taskFromBackend(task);
}

export async function updateProjectTask(projectId: string, taskId: string, data: Partial<{
  title: string;
  description: string;
  status: ProjectTaskStatus;
  due_date: string | null;
  progress: number;
  assignee_ids: string[];
}>) {
  const task = await apiFetch<ProjectTask>(`/api/v1/projects/${projectId}/tasks/${taskId}/`, {
    method: "PATCH",
    body: JSON.stringify({ ...data, status: data.status ? STATUS_TO_BACKEND[data.status] : undefined }),
  });
  return taskFromBackend(task);
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

export function listProjectDocuments(projectId: string) {
  return apiFetch<ProjectDocument[]>(`/api/v1/projects/${projectId}/documents/`);
}

/** Pas apiFetch() — même raison que uploadImage() (lib/api/upload.ts) :
 * il force Content-Type: application/json, incompatible avec le corps
 * multipart d'un FormData. */
export async function uploadProjectDocument(projectId: string, file: File): Promise<ProjectDocument> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/documents/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let detail = `Échec de l'envoi (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      // pas de corps JSON
    }
    throw new Error(detail);
  }

  return response.json();
}

export interface ProjectMemberStats {
  user: { id: string; first_name: string; last_name: string; avatar_url: string | null };
  tasks_assigned: number;
  tasks_done: number;
  hours_logged: number;
}

export function getProjectStats(projectId: string) {
  return apiFetch<{ members: ProjectMemberStats[] }>(`/api/v1/projects/${projectId}/stats/`);
}
