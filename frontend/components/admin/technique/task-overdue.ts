import type { ProjectTask } from "@/lib/api/types";

/** Date du jour au format AAAA-MM-JJ (heure locale) — à figer une fois par
 * composant (useState), pas à recalculer pendant le rendu. */
export function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** En retard : échéance dépassée et tâche pas terminée. Les dates ISO se
 * comparent directement comme chaînes. */
export function isTaskOverdue(task: Pick<ProjectTask, "due_date" | "status">, today: string) {
  return Boolean(task.due_date && task.due_date < today && task.status !== "DONE");
}
