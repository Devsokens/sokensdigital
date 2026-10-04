import { auth } from "@/lib/firebase/config";
import { apiFetch } from "@/lib/api/client";
import type {
  Epic,
  Label,
  Paginated,
  Project,
  ProjectDocument,
  ProjectMember,
  ProjectSubtask,
  ProjectTask,
  ProjectTaskComment,
  ProjectTaskStatus,
  Sprint,
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

export function listProjects(params?: { search?: string; client?: string }) {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.client) query.set("client", params.client);
  const qs = query.toString();
  return apiFetch<Paginated<Project>>(`/api/v1/projects/${qs ? `?${qs}` : ""}`);
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
  client_id?: string | null;
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
  priority?: string | null;
  due_date?: string;
  progress?: number;
  assignee_ids?: string[];
  epic?: string | null;
  sprint?: string | null;
  label_ids?: string[];
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
  priority: string | null;
  due_date: string | null;
  progress: number;
  assignee_ids: string[];
  epic: string | null;
  sprint: string | null;
  label_ids: string[];
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

/** Pas apiFetch() dès qu'une pièce jointe est fournie — FormData,
 * incompatible avec le Content-Type: application/json forcé par apiFetch. */
export async function createTaskComment(projectId: string, taskId: string, body: string, attachment?: File): Promise<ProjectTaskComment> {
  if (!attachment) {
    return apiFetch<ProjectTaskComment>(`/api/v1/projects/${projectId}/tasks/${taskId}/comments/`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }

  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const formData = new FormData();
  formData.append("body", body);
  formData.append("attachment", attachment);

  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/tasks/${taskId}/comments/`, {
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

export function listEpics(projectId: string) {
  return apiFetch<Epic[]>(`/api/v1/projects/${projectId}/epics/`);
}

export function createEpic(projectId: string, data: { title: string; color?: string; start_date: string; end_date: string }) {
  return apiFetch<Epic>(`/api/v1/projects/${projectId}/epics/`, { method: "POST", body: JSON.stringify(data) });
}

export function updateEpic(projectId: string, epicId: string, data: Partial<{
  title: string; color: string; start_date: string | null; end_date: string | null;
}>) {
  return apiFetch<Epic>(`/api/v1/projects/${projectId}/epics/${epicId}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteEpic(projectId: string, epicId: string) {
  return apiFetch<void>(`/api/v1/projects/${projectId}/epics/${epicId}/`, { method: "DELETE" });
}

export function listLabels(projectId: string) {
  return apiFetch<Label[]>(`/api/v1/projects/${projectId}/labels/`);
}

export function createLabel(projectId: string, data: { name: string; color?: string }) {
  return apiFetch<Label>(`/api/v1/projects/${projectId}/labels/`, { method: "POST", body: JSON.stringify(data) });
}

export function updateLabel(projectId: string, labelId: string, data: Partial<{ name: string; color: string }>) {
  return apiFetch<Label>(`/api/v1/projects/${projectId}/labels/${labelId}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteLabel(projectId: string, labelId: string) {
  return apiFetch<void>(`/api/v1/projects/${projectId}/labels/${labelId}/`, { method: "DELETE" });
}

export function listSprints(projectId: string) {
  return apiFetch<Sprint[]>(`/api/v1/projects/${projectId}/sprints/`);
}

export function createSprint(projectId: string, data: { name: string; start_date?: string | null; end_date?: string | null }) {
  return apiFetch<Sprint>(`/api/v1/projects/${projectId}/sprints/`, { method: "POST", body: JSON.stringify(data) });
}

export function updateSprint(projectId: string, sprintId: string, data: Partial<{ name: string; start_date: string | null; end_date: string | null }>) {
  return apiFetch<Sprint>(`/api/v1/projects/${projectId}/sprints/${sprintId}/`, { method: "PATCH", body: JSON.stringify(data) });
}

export function deleteSprint(projectId: string, sprintId: string) {
  return apiFetch<void>(`/api/v1/projects/${projectId}/sprints/${sprintId}/`, { method: "DELETE" });
}

export function listSubtasks(projectId: string, taskId: string) {
  return apiFetch<ProjectSubtask[]>(`/api/v1/projects/${projectId}/tasks/${taskId}/subtasks/`);
}

export function createSubtask(projectId: string, taskId: string, title: string) {
  return apiFetch<ProjectSubtask>(`/api/v1/projects/${projectId}/tasks/${taskId}/subtasks/`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export function updateSubtask(projectId: string, taskId: string, subtaskId: string, data: Partial<{ title: string; is_done: boolean; order: number }>) {
  return apiFetch<ProjectSubtask>(`/api/v1/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteSubtask(projectId: string, taskId: string, subtaskId: string) {
  return apiFetch<void>(`/api/v1/projects/${projectId}/tasks/${taskId}/subtasks/${subtaskId}/`, { method: "DELETE" });
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
