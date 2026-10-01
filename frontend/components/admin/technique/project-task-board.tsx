"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  CircleDot,
  Eye,
  Loader2,
  MessageSquare,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Modal, ModalTrigger, ModalClose, ModalContent } from "@/components/ui/modal";
import { MultiSelectSearch } from "@/components/admin/multi-select-search";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { cn } from "@/lib/utils";
import {
  listProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  listTaskComments,
  createTaskComment,
  listEpics,
  listLabels,
  listSprints,
  createSubtask,
  updateSubtask,
  deleteSubtask,
} from "@/lib/api/projects";
import type {
  Epic,
  Label as ProjectLabel,
  Project,
  ProjectPriority,
  ProjectSubtask,
  ProjectTask,
  ProjectTaskComment,
  ProjectTaskStatus,
  ProjectUserBrief,
  Sprint,
} from "@/lib/api/types";

const STATUS_ORDER: ProjectTaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"];

const STATUS_META: Record<ProjectTaskStatus, { label: string; icon: LucideIcon; badge: string; bar: string }> = {
  TODO: { label: "À faire", icon: Circle, badge: "bg-neutral-100 text-neutral-600", bar: "bg-neutral-400" },
  IN_PROGRESS: { label: "En cours", icon: CircleDot, badge: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500" },
  IN_REVIEW: { label: "En révision", icon: Eye, badge: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  DONE: { label: "Terminé", icon: CheckCircle2, badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
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
  onAdd,
}: {
  members: ProjectUserBrief[];
  labels: ProjectLabel[];
  onAdd: (data: { title: string; description: string; assignee_ids: string[]; due_date?: string; priority?: string | null; label_ids?: string[] }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ProjectPriority | "">("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const memberOptions = members.map((m) => ({ id: m.id, label: `${m.first_name} ${m.last_name}`.trim() }));
  const labelOptions = labels.map((l) => ({ id: l.id, label: l.name }));

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
      });
      setTitle("");
      setDescription("");
      setAssigneeIds([]);
      setDueDate("");
      setPriority("");
      setLabelIds([]);
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

          {labelOptions.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <span className={labelClass}>Étiquettes</span>
              <MultiSelectSearch
                options={labelOptions}
                values={labelIds}
                onChange={setLabelIds}
                placeholder="Ajouter des étiquettes…"
              />
            </motion.div>
          )}

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

function SubtaskList({ projectId, task }: { projectId: string; task: ProjectTask }) {
  const [subtasks, setSubtasks] = useState<ProjectSubtask[]>(task.subtasks);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    setSubtasks(task.subtasks);
  }, [task.id, task.subtasks]);

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    const subtask = await createSubtask(projectId, task.id, title);
    setSubtasks((prev) => [...prev, subtask]);
  }

  async function handleToggle(subtask: ProjectSubtask) {
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, is_done: !s.is_done } : s)));
    await updateSubtask(projectId, task.id, subtask.id, { is_done: !subtask.is_done });
  }

  async function handleDelete(subtask: ProjectSubtask) {
    setSubtasks((prev) => prev.filter((s) => s.id !== subtask.id));
    await deleteSubtask(projectId, task.id, subtask.id);
  }

  return (
    <div>
      <span className={labelClass}>Sous-tâches</span>
      <div className="space-y-1">
        {subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-neutral-50">
            <button
              type="button"
              onClick={() => handleToggle(s)}
              className={cn(
                "flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors",
                s.is_done ? "border-primary bg-primary text-primary-foreground" : "border-neutral-300"
              )}
            >
              {s.is_done && <Check className="size-3" />}
            </button>
            <span className={cn("flex-1 text-sm", s.is_done ? "text-neutral-400 line-through" : "text-neutral-700")}>
              {s.title}
            </span>
            <button
              type="button"
              onClick={() => handleDelete(s)}
              className="shrink-0 text-neutral-300 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Ajouter une sous-tâche…"
          className={inputClass}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newTitle.trim()}
          className="shrink-0 rounded-lg border border-neutral-200 px-3 py-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function TaskDetailSheet({
  task,
  projectId,
  members,
  epics,
  sprints,
  labels,
  onClose,
  onUpdate,
  onDelete,
}: {
  task: ProjectTask | null;
  projectId: string;
  members: ProjectUserBrief[];
  epics: Epic[];
  sprints: Sprint[];
  labels: ProjectLabel[];
  onClose: () => void;
  onUpdate: (taskId: string, data: Partial<{
    title: string; status: ProjectTaskStatus; priority: ProjectPriority | null; due_date: string | null;
    progress: number; assignee_ids: string[]; epic: string | null; sprint: string | null; label_ids: string[];
  }>) => void;
  onDelete: (taskId: string) => void;
}) {
  const [comments, setComments] = useState<ProjectTaskComment[] | null>(null);
  const [newComment, setNewComment] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!task) {
      setComments(null);
      return;
    }
    setComments(null);
    setAttachment(null);
    listTaskComments(projectId, task.id).then(setComments).catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) return null;
  const assigneeIds = new Set(task.assignees.map((u) => u.id));
  const taskLabelIds = new Set(task.labels.map((l) => l.id));

  async function handlePostComment() {
    if (!task || (!newComment.trim() && !attachment)) return;
    setPosting(true);
    try {
      const comment = await createTaskComment(projectId, task.id, newComment.trim(), attachment ?? undefined);
      setComments((prev) => (prev ? [...prev, comment] : [comment]));
      setNewComment("");
      setAttachment(null);
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

          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className={labelClass}>Priorité</span>
              <select
                value={task.priority ?? ""}
                onChange={(e) => onUpdate(task.id, { priority: (e.target.value as ProjectPriority) || null })}
                className={inputClass}
              >
                <option value="">—</option>
                {(["BASSE", "MOYENNE", "HAUTE"] as ProjectPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Epic</span>
              <select
                value={task.epic ?? ""}
                onChange={(e) => onUpdate(task.id, { epic: e.target.value || null })}
                className={inputClass}
              >
                <option value="">—</option>
                {epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>{ep.title}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Sprint</span>
              <select
                value={task.sprint ?? ""}
                onChange={(e) => onUpdate(task.id, { sprint: e.target.value || null })}
                className={inputClass}
              >
                <option value="">—</option>
                {sprints.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.name}</option>
                ))}
              </select>
            </label>
          </div>

          {labels.length > 0 && (
            <div>
              <span className={labelClass}>Étiquettes</span>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => {
                  const active = taskLabelIds.has(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? task.labels.filter((tl) => tl.id !== l.id).map((tl) => tl.id)
                          : [...task.labels.map((tl) => tl.id), l.id];
                        onUpdate(task.id, { label_ids: next });
                      }}
                      className="rounded-full px-2.5 py-1 text-xs font-medium transition-opacity"
                      style={{
                        backgroundColor: active ? l.color : `${l.color}1a`,
                        color: active ? "#fff" : l.color,
                      }}
                    >
                      {l.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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

          <SubtaskList projectId={projectId} task={task} />

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
                  {c.body && <p className="text-neutral-600">{c.body}</p>}
                  {c.attachment_url && (
                    <a
                      href={c.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 flex items-center gap-1 text-primary hover:underline"
                    >
                      <Paperclip className="size-3" /> {c.attachment_name}
                    </a>
                  )}
                </div>
              ))}
            </div>
            {attachment && (
              <p className="mb-1.5 flex items-center justify-between rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
                <span className="flex items-center gap-1 truncate"><Paperclip className="size-3" /> {attachment.name}</span>
                <button type="button" onClick={() => setAttachment(null)} className="shrink-0"><X className="size-3.5" /></button>
              </p>
            )}
            <div className="flex items-center gap-2">
              <input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePostComment(); }}
                placeholder="Ajouter un commentaire…"
                className={inputClass}
              />
              <label className="flex shrink-0 cursor-pointer items-center justify-center rounded-lg border border-neutral-200 px-3 py-2.5 text-neutral-500 hover:bg-neutral-50">
                <Paperclip className="size-3.5" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                type="button"
                onClick={handlePostComment}
                disabled={posting || (!newComment.trim() && !attachment)}
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
  const [epics, setEpics] = useState<Epic[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);

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
    listSprints(project.id).then(setSprints).catch(() => setSprints([]));
    listLabels(project.id).then(setLabels).catch(() => setLabels([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function handleAdd(
    status: ProjectTaskStatus,
    data: { title: string; description: string; assignee_ids: string[]; due_date?: string; priority?: string | null; label_ids?: string[] },
  ) {
    const task = await createProjectTask(project.id, { ...data, status });
    setTasks((prev) => (prev ? [...prev, task] : [task]));
  }

  async function handleUpdate(taskId: string, data: Partial<{
    title: string; status: ProjectTaskStatus; priority: ProjectPriority | null; due_date: string | null;
    progress: number; assignee_ids: string[]; epic: string | null; sprint: string | null; label_ids: string[];
  }>) {
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
                  <AddTaskModal members={members} labels={labels} onAdd={(data) => handleAdd(status, data)} />
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
        epics={epics}
        sprints={sprints}
        labels={labels}
        onClose={() => setSelectedTaskId(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  );
}
