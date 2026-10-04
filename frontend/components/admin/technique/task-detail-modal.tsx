"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Flag,
  Layers,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  SendHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { cn } from "@/lib/utils";
import { LabelPicker } from "@/components/admin/technique/label-tag-input";
import { isTaskOverdue, todayIso } from "@/components/admin/technique/task-overdue";
import { SPRINTS_ENABLED } from "@/lib/admin/project-features";
import {
  listTaskComments,
  createTaskComment,
  createSubtask,
  updateSubtask,
  deleteSubtask,
} from "@/lib/api/projects";
import type {
  Epic,
  Label as ProjectLabel,
  ProjectPriority,
  ProjectSubtask,
  ProjectTask,
  ProjectTaskComment,
  ProjectTaskStatus,
  ProjectUserBrief,
  Sprint,
} from "@/lib/api/types";

export type TaskUpdate = Partial<{
  title: string;
  description: string;
  status: ProjectTaskStatus;
  priority: ProjectPriority | null;
  due_date: string | null;
  assignee_ids: string[];
  epic: string | null;
  sprint: string | null;
  label_ids: string[];
}>;

const STATUS_OPTIONS: { value: ProjectTaskStatus; label: string; badge: string }[] = [
  { value: "TODO", label: "À faire", badge: "bg-neutral-100 text-neutral-600" },
  { value: "IN_PROGRESS", label: "En cours", badge: "bg-indigo-100 text-indigo-700" },
  { value: "IN_REVIEW", label: "En révision", badge: "bg-amber-100 text-amber-700" },
  { value: "DONE", label: "Terminé", badge: "bg-emerald-100 text-emerald-700" },
];

const PRIORITY_LABELS: Record<ProjectPriority, string> = { BASSE: "Basse", MOYENNE: "Moyenne", HAUTE: "Haute" };
const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  BASSE: "bg-sky-100 text-sky-700",
  MOYENNE: "bg-violet-100 text-violet-700",
  HAUTE: "bg-orange-100 text-orange-700",
};

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Sous-tâches : la source de vérité reste la tâche du tableau parent
 * (onChange) — avec une copie locale, les sous-tâches ajoutées disparaissaient
 * à la réouverture de la tâche, le tableau gardant sa liste du chargement. */
function SubtaskList({
  projectId,
  task,
  onChange,
}: {
  projectId: string;
  task: ProjectTask;
  onChange: (subtasks: ProjectSubtask[]) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const subtasks = task.subtasks;
  const doneCount = subtasks.filter((s) => s.is_done).length;

  async function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    setError(null);
    try {
      const subtask = await createSubtask(projectId, task.id, title);
      onChange([...subtasks, subtask]);
    } catch {
      setNewTitle(title);
      setError("Impossible d'ajouter cette sous-tâche.");
    }
  }

  async function handleToggle(subtask: ProjectSubtask) {
    onChange(subtasks.map((s) => (s.id === subtask.id ? { ...s, is_done: !s.is_done } : s)));
    try {
      await updateSubtask(projectId, task.id, subtask.id, { is_done: !subtask.is_done });
    } catch {
      onChange(subtasks);
      setError("Impossible de mettre à jour cette sous-tâche.");
    }
  }

  async function handleDelete(subtask: ProjectSubtask) {
    onChange(subtasks.filter((s) => s.id !== subtask.id));
    try {
      await deleteSubtask(projectId, task.id, subtask.id);
    } catch {
      onChange(subtasks);
      setError("Impossible de supprimer cette sous-tâche.");
    }
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">Sous-tâches</h3>
        {subtasks.length > 0 && (
          <span className="text-xs text-neutral-500">{doneCount} / {subtasks.length}</span>
        )}
      </div>
      {subtasks.length > 0 && (
        <div className="mb-2 h-1 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / subtasks.length) * 100}%` }} />
        </div>
      )}
      <div className="space-y-0.5">
        {subtasks.map((s) => (
          <div key={s.id} className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-neutral-50">
            <button
              type="button"
              onClick={() => handleToggle(s)}
              className={cn(
                "flex size-[18px] shrink-0 items-center justify-center rounded border transition-colors",
                s.is_done ? "border-emerald-500 bg-emerald-500 text-white" : "border-neutral-300 hover:border-neutral-400"
              )}
              aria-label={s.is_done ? "Marquer comme non terminée" : "Marquer comme terminée"}
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
              aria-label="Supprimer la sous-tâche"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1 flex items-center gap-2.5 px-1.5">
        <Plus className="size-[18px] shrink-0 text-neutral-300" />
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Ajouter une sous-tâche puis Entrée…"
          className="w-full bg-transparent py-1.5 text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </section>
  );
}

function CommentBubble({ comment, mine }: { comment: ProjectTaskComment; mine: boolean }) {
  const author = comment.author;
  return (
    <div className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
      {!mine && (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
          {initials(author?.first_name, author?.last_name)}
        </span>
      )}
      <div className={cn("flex max-w-[75%] flex-col", mine ? "items-end" : "items-start")}>
        {!mine && (
          <span className="mb-0.5 px-1 text-[11px] font-medium text-neutral-500">
            {author ? `${author.first_name} ${author.last_name}` : "—"}
          </span>
        )}
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm",
            mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-neutral-100 text-neutral-800"
          )}
        >
          {comment.body && <p className="whitespace-pre-wrap break-words">{comment.body}</p>}
          {comment.attachment_url && (
            <a
              href={comment.attachment_url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs underline-offset-2 hover:underline",
                mine ? "bg-white/15" : "bg-white text-primary"
              )}
            >
              <Paperclip className="size-3.5 shrink-0" />
              <span className="truncate">{comment.attachment_name}</span>
            </a>
          )}
        </div>
        <span className="mt-0.5 px-1 text-[10px] text-neutral-400">{formatTime(comment.created_at)}</span>
      </div>
    </div>
  );
}

function EditPanel({
  task,
  members,
  epics,
  sprints,
  labels,
  onUpdate,
  onCreateLabel,
  onDelete,
}: {
  task: ProjectTask;
  members: ProjectUserBrief[];
  epics: Epic[];
  sprints: Sprint[];
  labels: ProjectLabel[];
  onUpdate: (data: TaskUpdate) => void;
  onCreateLabel: (name: string, color: string) => Promise<ProjectLabel>;
  onDelete: () => void;
}) {
  const assigneeIds = new Set(task.assignees.map((u) => u.id));

  return (
    <div className="space-y-4 p-5">
      <label className="block">
        <span className={labelClass}>Titre</span>
        <input
          key={`title-${task.id}`}
          defaultValue={task.title}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value && value !== task.title) onUpdate({ title: value });
          }}
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className={labelClass}>Description</span>
        <textarea
          key={`desc-${task.id}`}
          defaultValue={task.description}
          rows={4}
          onBlur={(e) => { if (e.target.value !== task.description) onUpdate({ description: e.target.value }); }}
          className={cn(inputClass, "resize-none")}
          placeholder="Décrivez ce qui est attendu…"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Statut</span>
          <select value={task.status} onChange={(e) => onUpdate({ status: e.target.value as ProjectTaskStatus })} className={inputClass}>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Priorité</span>
          <select
            value={task.priority ?? ""}
            onChange={(e) => onUpdate({ priority: (e.target.value as ProjectPriority) || null })}
            className={inputClass}
          >
            <option value="">—</option>
            {(["BASSE", "MOYENNE", "HAUTE"] as ProjectPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Échéance</span>
        <input type="date" value={task.due_date ?? ""} onChange={(e) => onUpdate({ due_date: e.target.value || null })} className={inputClass} />
      </label>

      <div className={cn("grid gap-3", SPRINTS_ENABLED && "grid-cols-2")}>
        <label className="block">
          <span className={labelClass}>Phase</span>
          <select value={task.epic ?? ""} onChange={(e) => onUpdate({ epic: e.target.value || null })} className={inputClass}>
            <option value="">—</option>
            {epics.map((ep) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
          </select>
        </label>
        {SPRINTS_ENABLED && (
          <label className="block">
            <span className={labelClass}>Sprint</span>
            <select value={task.sprint ?? ""} onChange={(e) => onUpdate({ sprint: e.target.value || null })} className={inputClass}>
              <option value="">—</option>
              {sprints.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
            </select>
          </label>
        )}
      </div>

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
                  onUpdate({ assignee_ids: next });
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs transition-colors",
                  active ? "bg-primary/10 text-primary" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                )}
              >
                {u.first_name} {u.last_name}
              </button>
            );
          })}
          {members.length === 0 && <span className="text-xs text-neutral-400">Aucun membre sur ce projet.</span>}
        </div>
      </div>

      <div>
        <span className={labelClass}>Étiquettes</span>
        <LabelPicker
          available={labels}
          selectedIds={task.labels.map((l) => l.id)}
          onChange={(ids) => onUpdate({ label_ids: ids })}
          onCreate={onCreateLabel}
        />
      </div>

      <button
        type="button"
        onClick={() => { if (confirm(`Supprimer « ${task.title} » ?`)) onDelete(); }}
        className="flex items-center gap-1.5 pt-2 text-xs font-medium text-destructive hover:underline"
      >
        <Trash2 className="size-3.5" /> Supprimer cette tâche
      </button>
    </div>
  );
}

/** Détail d'une tâche : lecture (description, sous-tâches, discussion) par
 * défaut ; « Modifier » ouvre un panneau à droite qui élargit le panneau avec
 * tous les champs éditables. Toujours monté, piloté par `task` (null =
 * fermé), comme l'ancienne Sheet. */
export function TaskDetailModal({
  open,
  task,
  projectId,
  members,
  epics,
  sprints,
  labels,
  currentUserId,
  onCreateLabel,
  onClose,
  onUpdate,
  onSubtasksChange,
  onCommentAdded,
  onDelete,
}: {
  /** Séparé de `task` : la tâche reste affichée pendant que le panneau
   * glisse vers la droite à la fermeture. */
  open: boolean;
  task: ProjectTask | null;
  projectId: string;
  members: ProjectUserBrief[];
  epics: Epic[];
  sprints: Sprint[];
  labels: ProjectLabel[];
  currentUserId: string | null;
  onCreateLabel: (name: string, color: string) => Promise<ProjectLabel>;
  onClose: () => void;
  onUpdate: (taskId: string, data: TaskUpdate) => void;
  onSubtasksChange: (taskId: string, subtasks: ProjectSubtask[]) => void;
  onCommentAdded: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [today] = useState(todayIso);
  const [comments, setComments] = useState<ProjectTaskComment[] | null>(null);
  const [newComment, setNewComment] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Remise à zéro à l'ouverture seulement : à la fermeture, le contenu doit
  // rester tel quel pendant que le panneau glisse vers la droite.
  useEffect(() => {
    if (!open || !task) return;
    setEditing(false);
    setComments(null);
    setNewComment("");
    setAttachment(null);
    setPostError(null);
    listTaskComments(projectId, task.id).then(setComments).catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, open]);

  async function handlePostComment() {
    if (!task || posting || (!newComment.trim() && !attachment)) return;
    setPosting(true);
    setPostError(null);
    try {
      const comment = await createTaskComment(projectId, task.id, newComment.trim(), attachment ?? undefined);
      setComments((prev) => (prev ? [...prev, comment] : [comment]));
      setNewComment("");
      setAttachment(null);
      onCommentAdded(task.id);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "Impossible d'envoyer ce message.");
    } finally {
      setPosting(false);
    }
  }

  const status = task ? STATUS_OPTIONS.find((s) => s.value === task.status) : null;
  const epic = task ? epics.find((e) => e.id === task.epic) : null;
  const sprint = task ? sprints.find((s) => s.id === task.sprint) : null;

  return (
    <Dialog.Root open={open && !!task} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          )}
        />
        <Dialog.Popup
          className={cn(
            // Panneau collé à droite, qui glisse de la droite vers la gauche
            // à l'ouverture (et repart vers la droite à la fermeture).
            "fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col overflow-hidden bg-white shadow-2xl",
            "transition-[max-width,translate] duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
            editing ? "max-w-6xl" : "max-w-3xl"
          )}
        >
          {task && (
            <>
              {/* En-tête */}
              <div className="flex shrink-0 items-center gap-3 border-b border-neutral-100 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="truncate text-base font-semibold text-neutral-900">{task.title}</Dialog.Title>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {status && <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.badge)}>{status.label}</span>}
                    {isTaskOverdue(task, today) && (
                      <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                        <AlertTriangle className="size-3" /> En retard
                      </span>
                    )}
                    {task.priority && (
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PRIORITY_COLORS[task.priority])}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    editing ? "bg-neutral-900 text-white hover:bg-neutral-700" : "border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  {editing ? <><Check className="size-3.5" /> Terminer</> : <><Pencil className="size-3.5" /> Modifier</>}
                </button>
                <Dialog.Close
                  aria-label="Fermer"
                  className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>

              <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                {/* Panneau d'édition, à droite — n'apparaît qu'en mode
                 * Modifier (au-dessus du contenu sur petit écran). */}
                {editing && (
                  <aside className="max-h-[45%] shrink-0 overflow-y-auto border-b border-neutral-100 bg-neutral-50/60 md:order-last md:max-h-none md:w-[22rem] md:border-b-0 md:border-l">
                    <EditPanel
                      task={task}
                      members={members}
                      epics={epics}
                      sprints={sprints}
                      labels={labels}
                      onUpdate={(data) => onUpdate(task.id, data)}
                      onCreateLabel={onCreateLabel}
                      onDelete={() => onDelete(task.id)}
                    />
                  </aside>
                )}

                {/* Lecture + discussion */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                  <div ref={scrollRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600">
                      <span className={cn("flex items-center gap-1.5", isTaskOverdue(task, today) && "font-medium text-rose-600")}>
                        <CalendarDays className={cn("size-3.5", isTaskOverdue(task, today) ? "text-rose-500" : "text-neutral-400")} />
                        {task.due_date ? `Échéance : ${formatDate(task.due_date)}` : "Pas d'échéance"}
                      </span>
                      {epic && (
                        <span className="flex items-center gap-1.5">
                          <Layers className="size-3.5 text-neutral-400" /> {epic.title}
                        </span>
                      )}
                      {SPRINTS_ENABLED && sprint && (
                        <span className="flex items-center gap-1.5">
                          <Flag className="size-3.5 text-neutral-400" /> {sprint.name}
                        </span>
                      )}
                    </div>

                    {(task.assignees.length > 0 || task.labels.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {task.assignees.map((u) => (
                          <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-neutral-100 py-0.5 pr-2.5 pl-0.5 text-xs text-neutral-700">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                              {initials(u.first_name, u.last_name)}
                            </span>
                            {u.first_name} {u.last_name}
                          </span>
                        ))}
                        {task.labels.map((l) => (
                          <span key={l.id} className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: `${l.color}1a`, color: l.color }}>
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <section>
                      <h3 className="mb-1.5 text-sm font-semibold text-neutral-900">Description</h3>
                      {task.description ? (
                        <p className="whitespace-pre-wrap text-sm text-neutral-700">{task.description}</p>
                      ) : (
                        <p className="text-sm text-neutral-400">Aucune description — cliquez sur Modifier pour en ajouter une.</p>
                      )}
                    </section>

                    <SubtaskList
                      projectId={projectId}
                      task={task}
                      onChange={(subtasks) => onSubtasksChange(task.id, subtasks)}
                    />

                    <section>
                      <h3 className="mb-3 text-sm font-semibold text-neutral-900">Discussion</h3>
                      <div className="space-y-3">
                        {comments === null && <Loader2 className="size-4 animate-spin text-neutral-400" />}
                        {comments?.length === 0 && (
                          <p className="text-sm text-neutral-400">Aucun message pour l&apos;instant. Lancez la discussion ci-dessous.</p>
                        )}
                        {comments?.map((c) => (
                          <CommentBubble key={c.id} comment={c} mine={!!currentUserId && c.author?.id === currentUserId} />
                        ))}
                      </div>
                    </section>
                  </div>

                  {/* Zone de saisie, toujours en bas */}
                  <div className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3">
                    {attachment && (
                      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-primary/5 px-3 py-1.5 text-xs text-primary">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Paperclip className="size-3.5 shrink-0" />
                          <span className="truncate">{attachment.name}</span>
                        </span>
                        <button type="button" onClick={() => setAttachment(null)} aria-label="Retirer la pièce jointe">
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}
                    {postError && <p className="mb-2 text-xs text-destructive">{postError}</p>}
                    <div className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-2 py-1.5 focus-within:border-primary/50">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200/60 hover:text-neutral-800"
                        aria-label="Joindre un fichier"
                      >
                        <Paperclip className="size-4" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          setAttachment(e.target.files?.[0] ?? null);
                          e.target.value = "";
                        }}
                      />
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handlePostComment();
                          }
                        }}
                        rows={1}
                        placeholder="Écrire un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
                        className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-400 [field-sizing:content]"
                      />
                      <button
                        type="button"
                        onClick={handlePostComment}
                        disabled={posting || (!newComment.trim() && !attachment)}
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                        aria-label="Envoyer"
                      >
                        {posting ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
