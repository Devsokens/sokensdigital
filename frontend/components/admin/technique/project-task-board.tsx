"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Circle,
  CircleDot,
  Eye,
  Loader2,
  MessageSquare,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Modal, ModalTrigger, ModalClose, ModalContent } from "@/components/ui/modal";
import { MultiSelectSearch } from "@/components/admin/multi-select-search";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { TaskDetailModal, type TaskUpdate } from "@/components/admin/technique/task-detail-modal";
import { cn } from "@/lib/utils";
import {
  listProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  listEpics,
  listLabels,
  createLabel,
  listSprints,
} from "@/lib/api/projects";
import { getMe } from "@/lib/api/me";
import { isTaskOverdue, todayIso } from "@/components/admin/technique/task-overdue";
import { LabelPicker } from "@/components/admin/technique/label-tag-input";
import { SPRINTS_ENABLED } from "@/lib/admin/project-features";
import type {
  Epic,
  Label as ProjectLabel,
  Project,
  ProjectPriority,
  ProjectSubtask,
  ProjectTask,
  ProjectTaskStatus,
  ProjectUserBrief,
  Sprint,
} from "@/lib/api/types";

const STATUS_ORDER: ProjectTaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const STATUS_META: Record<ProjectTaskStatus, { label: string; icon: LucideIcon; badge: string }> = {
  TODO: { label: "À faire", icon: Circle, badge: "bg-neutral-100 text-neutral-600" },
  IN_PROGRESS: { label: "En cours", icon: CircleDot, badge: "bg-indigo-100 text-indigo-700" },
  IN_REVIEW: { label: "En révision", icon: Eye, badge: "bg-amber-100 text-amber-700" },
  DONE: { label: "Terminé", icon: CheckCircle2, badge: "bg-emerald-100 text-emerald-700" },
};

const PRIORITY_LABELS: Record<ProjectPriority, string> = { BASSE: "Basse", MOYENNE: "Moyenne", HAUTE: "Haute" };
const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  BASSE: "bg-sky-100 text-sky-700",
  MOYENNE: "bg-violet-100 text-violet-700",
  HAUTE: "bg-orange-100 text-orange-700",
};

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatShort(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function TaskCard({ task, phase, today, onOpen, onDragStart }: {
  task: ProjectTask;
  phase: Epic | null;
  today: string;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const overdue = isTaskOverdue(task, today);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className={cn(
        "cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-colors hover:border-primary/40",
        overdue ? "border-rose-200" : "border-neutral-200"
      )}
    >
      {phase && (
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase" style={{ color: phase.color }}>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: phase.color }} />
          <span className="truncate">{phase.title}</span>
        </p>
      )}
      <div className="mb-2 flex items-center justify-between">
        <p className="truncate text-sm font-medium text-neutral-900">{task.title}</p>
      </div>
      {(task.labels.length > 0 || task.priority) && (
        <div className="mb-2 flex flex-wrap items-center gap-1">
          {task.priority && (
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_COLORS[task.priority])}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}
          {task.labels.map((l) => (
            <span key={l.id} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${l.color}1a`, color: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}
      {task.due_date && (
        <p className={cn("mb-3 flex items-center gap-1.5 text-[11px]", overdue ? "font-medium text-rose-600" : "text-neutral-400")}>
          <CalendarDays className="size-3" /> {formatShort(task.due_date)}
          {overdue && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
              <AlertTriangle className="size-3" /> En retard
            </span>
          )}
        </p>
      )}
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
        <span className="flex items-center gap-2.5 text-[11px] text-neutral-400">
          {task.subtasks.length > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="size-3.5" />
              {task.subtasks.filter((s) => s.is_done).length}/{task.subtasks.length}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageSquare className="size-3.5" /> {task.comments_count}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Remplace l'ancien ajout inline (un simple champ titre) par une modale
 * centrée animée — nom, description et assignation dès la création, comme
 * demandé, plutôt qu'un titre seul suivi d'une édition à part. Le
 * mouvement motion design demandé s'ajoute par-dessus la transition déjà
 * posée par ModalContent (fondu + zoom, components/ui/modal.tsx) : bouton
 * qui réagit au survol/clic, et les champs qui arrivent en cascade à
 * l'ouverture. */
function AddTaskModal({
  members,
  labels,
  phases,
  onCreateLabel,
  onAdd,
}: {
  members: ProjectUserBrief[];
  labels: ProjectLabel[];
  phases: Epic[];
  onCreateLabel: (name: string, color: string) => Promise<ProjectLabel>;
  onAdd: (data: { title: string; description: string; assignee_ids: string[]; due_date?: string; priority?: string | null; label_ids?: string[]; epic?: string | null }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ProjectPriority | "">("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [phaseId, setPhaseId] = useState("");
  const [saving, setSaving] = useState(false);

  const memberOptions = members.map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name}`.trim() }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd({
        title: title.trim(),
        description: description.trim(),
        assignee_ids: assigneeIds,
        due_date: dueDate || undefined,
        priority: priority || null,
        label_ids: labelIds,
        epic: phaseId || null,
      });
      setTitle("");
      setDescription("");
      setAssigneeIds([]);
      setDueDate("");
      setPriority("");
      setLabelIds([]);
      setPhaseId("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger
        render={
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-neutral-200 py-2 text-xs text-neutral-400 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <Plus className="size-3.5" /> Ajouter une tâche
          </motion.button>
        }
      />
      <ModalContent title="Nouvelle tâche">
        <form onSubmit={handleSubmit} className="space-y-4">
          <motion.label
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="block"
          >
            <span className={labelClass}>Nom de la tâche</span>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
          </motion.label>

          <motion.label
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="block"
          >
            <span className={labelClass}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Décrit ce qui est attendu…"
            />
          </motion.label>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <span className={labelClass}>Assigner à</span>
            <MultiSelectSearch
              options={memberOptions}
              values={assigneeIds}
              onChange={setAssigneeIds}
              placeholder="Rechercher un membre du projet…"
              emptyLabel="Aucun membre sur ce projet."
            />
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Échéance</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Priorité</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value as ProjectPriority | "")} className={inputClass}>
                <option value="">—</option>
                {(["BASSE", "MOYENNE", "HAUTE"] as ProjectPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </label>
          </motion.div>

          {phases.length > 0 && (
            <motion.label initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} className="block">
              <span className={labelClass}>Phase du projet</span>
              <select value={phaseId} onChange={(e) => setPhaseId(e.target.value)} className={inputClass}>
                <option value="">— Aucune —</option>
                {phases.map((ph) => (
                  <option key={ph.id} value={ph.id}>{ph.title}</option>
                ))}
              </select>
            </motion.label>
          )}

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <span className={labelClass}>Étiquettes</span>
            <LabelPicker available={labels} selectedIds={labelIds} onChange={setLabelIds} onCreate={onCreateLabel} />
          </motion.div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <ModalClose render={<button type="button" className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Annuler</button>} />
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />} Créer la tâche
            </button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

/** Kanban board shown as a project's task page. `project` only needs its id
 * and members (for the assignee picker). `onTasksChange` lets the page's
 * progress sidebar follow every add/move/delete without refetching.
 * `refreshKey` changes when phases/labels/sprints were edited elsewhere. */
export function ProjectTaskBoard({
  project,
  refreshKey = 0,
  onTasksChange,
}: {
  project: Project;
  refreshKey?: number;
  onTasksChange?: (tasks: ProjectTask[]) => void;
}) {
  const [tasks, setTasks] = useState<ProjectTask[] | null>(null);

  useEffect(() => {
    if (tasks) onTasksChange?.(tasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dragOverStatus, setDragOverStatus] = useState<ProjectTaskStatus | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [today] = useState(todayIso);

  async function load() {
    try {
      setTasks(await listProjectTasks(project.id));
    } catch {
      setError("Impossible de charger les tâches.");
    }
  }

  useEffect(() => {
    load();
    listEpics(project.id).then(setEpics).catch(() => setEpics([]));
    if (SPRINTS_ENABLED) listSprints(project.id).then(setSprints).catch(() => setSprints([]));
    listLabels(project.id).then(setLabels).catch(() => setLabels([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, refreshKey]);

  useEffect(() => {
    getMe().then((me) => setCurrentUserId(me.id)).catch(() => setCurrentUserId(null));
  }, []);

  async function handleCreateLabel(name: string, color: string) {
    const label = await createLabel(project.id, { name, color });
    setLabels((prev) => (prev.some((l) => l.id === label.id) ? prev : [...prev, label]));
    return label;
  }

  function handleSubtasksChange(taskId: string, subtasks: ProjectSubtask[]) {
    setTasks((prev) => prev?.map((t) => (t.id === taskId ? { ...t, subtasks } : t)) ?? prev);
  }

  function handleCommentAdded(taskId: string) {
    setTasks((prev) => prev?.map((t) => (t.id === taskId ? { ...t, comments_count: t.comments_count + 1 } : t)) ?? prev);
  }

  async function handleAdd(
    status: ProjectTaskStatus,
    data: { title: string; description: string; assignee_ids: string[]; due_date?: string; priority?: string | null; label_ids?: string[]; epic?: string | null },
  ) {
    const task = await createProjectTask(project.id, { ...data, status });
    setTasks((prev) => (prev ? [...prev, task] : [task]));
  }

  async function handleUpdate(taskId: string, data: TaskUpdate) {
    setTasks((prev) => prev?.map((t) => (t.id === taskId ? {
      ...t,
      ...data,
      assignees: data.assignee_ids ? members.filter((m) => data.assignee_ids!.includes(m.id)) : t.assignees,
      labels: data.label_ids ? labels.filter((l) => data.label_ids!.includes(l.id)) : t.labels,
    } : t)) ?? prev);
    try {
      const updated = await updateProjectTask(project.id, taskId, data);
      setTasks((prev) => prev?.map((t) => (t.id === taskId ? updated : t)) ?? prev);
    } catch {
      load();
    }
  }

  async function handleDelete(taskId: string) {
    setTasks((prev) => prev?.filter((t) => t.id !== taskId) ?? prev);
    setDetailOpen(false);
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
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">Toutes les tâches</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                      phase={epics.find((ep) => ep.id === task.epic) ?? null}
                      today={today}
                      onOpen={() => {
                        setSelectedTaskId(task.id);
                        setDetailOpen(true);
                      }}
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                    />
                  ))}
                  <AddTaskModal members={members} labels={labels} phases={epics} onCreateLabel={handleCreateLabel} onAdd={(data) => handleAdd(status, data)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <TaskDetailModal
        open={detailOpen}
        task={selectedTask}
        projectId={project.id}
        members={members}
        epics={epics}
        sprints={sprints}
        labels={labels}
        currentUserId={currentUserId}
        onCreateLabel={handleCreateLabel}
        onClose={() => setDetailOpen(false)}
        onUpdate={handleUpdate}
        onSubtasksChange={handleSubtasksChange}
        onCommentAdded={handleCommentAdded}
        onDelete={handleDelete}
      />
    </div>
  );
}
