"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  CircleDot,
  Eye,
  Loader2,
  MessageSquare,
  Plus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  listProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  listTaskComments,
  createTaskComment,
} from "@/lib/api/projects";
import type { Project, ProjectTask, ProjectTaskComment, ProjectTaskStatus, ProjectUserBrief } from "@/lib/api/types";

const STATUS_ORDER: ProjectTaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const STATUS_META: Record<ProjectTaskStatus, { label: string; icon: LucideIcon; badge: string; bar: string }> = {
  TODO: { label: "À faire", icon: Circle, badge: "bg-neutral-100 text-neutral-600", bar: "bg-neutral-400" },
  IN_PROGRESS: { label: "En cours", icon: CircleDot, badge: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500" },
  IN_REVIEW: { label: "En révision", icon: Eye, badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  DONE: { label: "Terminé", icon: CheckCircle2, badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
};

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatShort(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** A 14-day date strip with each task's due-date pill placed under its
 * column — a lightweight stand-in for a full Gantt/calendar view. */
function TaskCalendarStrip({ tasks }: { tasks: ProjectTask[] }) {
  const days = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - 3);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, []);
  const todayIso = isoDate(new Date());

  const byDay = useMemo(() => {
    const map = new Map<string, ProjectTask[]>();
    for (const task of tasks) {
      if (!task.due_date) continue;
      const list = map.get(task.due_date) ?? [];
      list.push(task);
      map.set(task.due_date, list);
    }
    return map;
  }, [tasks]);

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
      <div className="grid min-w-[980px]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(70px, 1fr))` }}>
        {days.map((day) => {
          const iso = isoDate(day);
          const isToday = iso === todayIso;
          return (
            <div
              key={iso}
              className={`min-h-[140px] border-l border-neutral-100 px-2 py-2 first:border-l-0 ${
                isToday ? "bg-primary/5" : ""
              }`}
            >
              <p className={`mb-2 text-[11px] font-medium ${isToday ? "text-primary" : "text-neutral-400"}`}>
                {day.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                {isToday && <span className="ml-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] text-white">Aujourd&apos;hui</span>}
              </p>
              <div className="space-y-1">
                {(byDay.get(iso) ?? []).map((task) => {
                  const meta = STATUS_META[task.status];
                  return (
                    <div
                      key={task.id}
                      className={`truncate rounded-md px-1.5 py-1 text-[10px] font-medium ${meta.badge}`}
                      title={task.title}
                    >
                      {task.title}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({ task, onOpen, onDragStart }: {
  task: ProjectTask;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const meta = STATUS_META[task.status];
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="cursor-pointer rounded-lg border border-neutral-200 bg-white p-3 shadow-sm transition-colors hover:border-primary/40"
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="truncate text-sm font-medium text-neutral-900">{task.title}</p>
      </div>
      {task.due_date && (
        <p className="mb-2 flex items-center gap-1 text-[11px] text-neutral-400">
          <CalendarDays className="size-3" /> {formatShort(task.due_date)}
        </p>
      )}
      <div className="mb-2 flex items-center justify-between text-[11px] text-neutral-400">
        <span>Progression : {task.progress}%</span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className={`h-full rounded-full ${meta.bar} transition-all`} style={{ width: `${task.progress}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex -space-x-1.5">
          {task.assignees.slice(0, 3).map((u) => (
            <span
              key={u.id}
              title={`${u.first_name} ${u.last_name}`}
              className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-primary/10 text-[9px] font-semibold text-primary"
            >
              {initials(u.first_name, u.last_name)}
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[11px] text-neutral-400">
          <MessageSquare className="size-3.5" /> {task.comments_count}
        </span>
      </div>
    </div>
  );
}

function AddTaskInline({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-200 py-2 text-xs text-neutral-400 transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Plus className="size-3.5" /> Ajouter une tâche
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        onAdd(title.trim());
        setTitle("");
        setOpen(false);
      }}
      className="space-y-1.5"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => { if (!title.trim()) setOpen(false); }}
        placeholder="Titre de la tâche…"
        className={inputClass}
      />
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
          Ajouter
        </button>
        <button type="button" onClick={() => { setOpen(false); setTitle(""); }} className="text-xs text-neutral-400">
          Annuler
        </button>
      </div>
    </form>
  );
}

function TaskDetailSheet({
  task,
  projectId,
  members,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: ProjectTask | null;
  projectId: string;
  members: ProjectUserBrief[];
  onClose: () => void;
  onUpdate: (taskId: string, data: Partial<{ title: string; status: ProjectTaskStatus; due_date: string | null; progress: number; assignee_ids: string[] }>) => void;
  onDelete: (taskId: string) => void;
}) {
  const [comments, setComments] = useState<ProjectTaskComment[] | null>(null);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!task) {
      setComments(null);
      return;
    }
    setComments(null);
    listTaskComments(projectId, task.id).then(setComments).catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) return null;
  const assigneeIds = new Set(task.assignees.map((u) => u.id));

  async function handlePostComment() {
    if (!task || !newComment.trim()) return;
    setPosting(true);
    try {
      const comment = await createTaskComment(projectId, task.id, newComment.trim());
      setComments((prev) => (prev ? [...prev, comment] : [comment]));
      setNewComment("");
    } finally {
      setPosting(false);
    }
  }

  return (
    <Sheet open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent title={task.title}>
        <div className="space-y-5">
          <label className="block">
            <span className={labelClass}>Titre</span>
            <input
              defaultValue={task.title}
              key={task.id}
              onBlur={(e) => { if (e.target.value.trim() && e.target.value !== task.title) onUpdate(task.id, { title: e.target.value.trim() }); }}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelClass}>Statut</span>
              <select
                value={task.status}
                onChange={(e) => onUpdate(task.id, { status: e.target.value as ProjectTaskStatus })}
                className={inputClass}
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Échéance</span>
              <input
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => onUpdate(task.id, { due_date: e.target.value || null })}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Progression ({task.progress}%)</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={task.progress}
              onChange={(e) => onUpdate(task.id, { progress: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </label>

          <div>
            <span className={labelClass}>Assigné à</span>
            <div className="flex flex-wrap gap-1.5">
              {members.map((u) => {
                const active = assigneeIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? task.assignees.filter((a) => a.id !== u.id).map((a) => a.id)
                        : [...task.assignees.map((a) => a.id), u.id];
                      onUpdate(task.id, { assignee_ids: next });
                    }}
                    className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                      active ? "bg-primary/10 text-primary" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                    }`}
                  >
                    {u.first_name} {u.last_name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className={labelClass}>Commentaires</span>
            <div className="mb-2 max-h-52 space-y-2 overflow-y-auto">
              {comments === null && <Loader2 className="size-4 animate-spin text-neutral-400" />}
              {comments?.length === 0 && <p className="text-xs text-neutral-400">Aucun commentaire.</p>}
              {comments?.map((c) => (
                <div key={c.id} className="rounded-lg bg-neutral-50 px-3 py-2 text-xs">
                  <p className="mb-0.5 font-medium text-neutral-700">
                    {c.author ? `${c.author.first_name} ${c.author.last_name}` : "—"}
                  </p>
                  <p className="text-neutral-600">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePostComment(); }}
                placeholder="Ajouter un commentaire…"
                className={inputClass}
              />
              <button
                type="button"
                onClick={handlePostComment}
                disabled={posting || !newComment.trim()}
                className="shrink-0 rounded-lg bg-primary px-3 py-2.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                Envoyer
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { if (confirm(`Supprimer "${task.title}" ?`)) onDelete(task.id); }}
            className="flex items-center gap-1.5 text-xs text-destructive hover:underline"
          >
            <X className="size-3.5" /> Supprimer cette tâche
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Kanban board + calendar strip shown as a project's task page. `project`
 * only needs its id and members (for the assignee picker). */
export function ProjectTaskBoard({ project }: { project: Project }) {
  const [tasks, setTasks] = useState<ProjectTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectTaskStatus | null>(null);

  async function load() {
    try {
      setTasks(await listProjectTasks(project.id));
    } catch {
      setError("Impossible de charger les tâches.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function handleAdd(status: ProjectTaskStatus, title: string) {
    const task = await createProjectTask(project.id, { title, status });
    setTasks((prev) => (prev ? [...prev, task] : [task]));
  }

  async function handleUpdate(taskId: string, data: Partial<{ title: string; status: ProjectTaskStatus; due_date: string | null; progress: number; assignee_ids: string[] }>) {
    setTasks((prev) => prev?.map((t) => (t.id === taskId ? { ...t, ...data, assignees: data.assignee_ids ? members.filter((m) => data.assignee_ids!.includes(m.id)) : t.assignees } : t)) ?? prev);
    const updated = await updateProjectTask(project.id, taskId, data);
    setTasks((prev) => prev?.map((t) => (t.id === taskId ? updated : t)) ?? prev);
  }

  async function handleDelete(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? prev);
    setSelectedTaskId(null);
    try {
      await deleteProjectTask(project.id, taskId);
    } catch {
      load();
    }
  }

  const members = project.members.map((m) => m.user);
  const selectedTask = tasks?.find((t) => t.id === selectedTaskId) ?? null;

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!tasks) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Calendrier des tâches</h2>
        <TaskCalendarStrip tasks={tasks} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Toutes les tâches</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const columnTasks = tasks.filter((t) => t.status === status);
            const Icon = meta.icon;
            return (
              <div
                key={status}
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(status); }}
                onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStatus(null);
                  const taskId = e.dataTransfer.getData("text/plain");
                  if (taskId) handleUpdate(taskId, { status });
                }}
                className={`rounded-xl border p-3 transition-colors ${
                  dragOverStatus === status ? "border-primary/50 bg-primary/5" : "border-neutral-200 bg-neutral-50/50"
                }`}
              >
                <div className="mb-3 flex items-center gap-1.5">
                  <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${meta.badge}`}>
                    <Icon className="size-3.5" /> {meta.label}
                  </span>
                  <span className="text-xs text-neutral-400">{columnTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onOpen={() => setSelectedTaskId(task.id)}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                    />
                  ))}
                  <AddTaskInline onAdd={(title) => handleAdd(status, title)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDetailSheet
        task={selectedTask}
        projectId={project.id}
        members={members}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
