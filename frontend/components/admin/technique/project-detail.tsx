"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { getProject, listEpics, createEpic, updateEpic, deleteEpic } from "@/lib/api/projects";
import { ProjectTaskBoard } from "@/components/admin/technique/project-task-board";
import { EditProjectForm } from "@/components/admin/technique/project-list";
import { PhaseForm, formatShortDate } from "@/components/admin/technique/project-phases";
import { AmbientVideoBackground } from "@/components/admin/technique/ambient-video-background";
import { formatFcfa } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import type { Epic, Project, ProjectPriority, ProjectStatus, ProjectTask, ProjectTaskStatus } from "@/lib/api/types";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  EN_COURS: "En cours",
  EN_PAUSE: "En pause",
  TERMINE: "Terminé",
  ANNULE: "Annulé",
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  EN_COURS: "bg-indigo-100 text-indigo-700",
  EN_PAUSE: "bg-neutral-100 text-neutral-500",
  TERMINE: "bg-emerald-100 text-emerald-700",
  ANNULE: "bg-rose-100 text-rose-600",
};

const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  BASSE: "Basse",
  MOYENNE: "Moyenne",
  HAUTE: "Haute",
};

const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  BASSE: "bg-sky-100 text-sky-700",
  MOYENNE: "bg-violet-100 text-violet-700",
  HAUTE: "bg-orange-100 text-orange-700",
};

// Mêmes teintes que les colonnes du kanban (project-task-board.tsx).
const TASK_STATUS_META: { status: ProjectTaskStatus; label: string; color: string }[] = [
  { status: "TODO", label: "À faire", color: "bg-neutral-400" },
  { status: "IN_PROGRESS", label: "En cours", color: "bg-indigo-500" },
  { status: "IN_REVIEW", label: "En révision", color: "bg-amber-500" },
  { status: "DONE", label: "Terminé", color: "bg-emerald-500" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Onglets du contenu de la barre latérale — le tableau des tâches, à droite,
// reste toujours affiché.
type SidebarView = "apercu" | "phases";

const VIEWS: { value: SidebarView; label: string; icon: React.ElementType }[] = [
  { value: "apercu", label: "Aperçu", icon: LayoutDashboard },
  { value: "phases", label: "Phases du projet", icon: Layers },
];


// Glisse de la gauche vers la droite, à l'aller (formulaire) comme au retour
// (barre normale) — même couloir, seul le contenu change.
const SLIDE = {
  initial: { x: -40, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 40, opacity: 0 },
  transition: { duration: 0.22, ease: "easeOut" },
} as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function SidebarSection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border-t border-neutral-100 px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-neutral-400" />
      <div className="min-w-0">
        <p className="text-[11px] text-neutral-400">{label}</p>
        <div className="text-sm text-neutral-800">{children}</div>
      </div>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 80 80" className="size-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="7" className="stroke-neutral-100" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-500"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-neutral-900">
        {value}%
      </span>
    </div>
  );
}

function ProgressSection({ project, tasks }: { project: Project; tasks: ProjectTask[] | null }) {
  const [now] = useState(() => Date.now());

  const stats = useMemo(() => {
    const total = tasks ? tasks.length : project.tasks_total;
    const done = tasks ? tasks.filter((t) => t.status === "DONE").length : project.tasks_done;
    const byStatus = TASK_STATUS_META.map((meta) => ({
      ...meta,
      count: tasks ? tasks.filter((t) => t.status === meta.status).length : 0,
    }));
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const overdue = tasks
      ? tasks.filter((t) => t.status !== "DONE" && t.due_date && new Date(`${t.due_date}T00:00:00`) < today).length
      : 0;
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0, byStatus, overdue };
  }, [project, tasks, now]);

  const timeline = useMemo(() => {
    if (!project.start_date || !project.end_date) return null;
    const start = new Date(`${project.start_date}T00:00:00`).getTime();
    const end = new Date(`${project.end_date}T00:00:00`).getTime();
    if (end <= start) return null;
    const pct = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
    const daysLeft = Math.ceil((end - now) / DAY_MS);
    return { pct, daysLeft };
  }, [project.start_date, project.end_date, now]);

  // En retard sur le calendrier : plus de temps consommé que de tâches
  // terminées, avec une marge de 10 points pour ne pas alerter pour rien.
  const behindSchedule = timeline !== null && stats.total > 0 && timeline.pct - stats.pct > 10 && stats.pct < 100;

  return (
    <SidebarSection title="État d'avancement">
      <div className="flex items-center gap-4">
        <ProgressRing value={stats.pct} />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold whitespace-nowrap text-neutral-900">
            {stats.done} / {stats.total} tâche{stats.total !== 1 ? "s" : ""}
          </p>
          <p className="text-xs text-neutral-500">terminée{stats.done !== 1 ? "s" : ""}</p>
          {stats.overdue > 0 && (
            <p className="flex items-center gap-1 pt-1 text-xs font-medium whitespace-nowrap text-rose-600">
              <AlertTriangle className="size-3.5" />
              {stats.overdue} en retard
            </p>
          )}
        </div>
        {tasks && (
          <div className="ml-auto w-32 shrink-0 space-y-1 border-l border-neutral-100 pl-4">
            {stats.byStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-neutral-600">
                  <span className={cn("size-2 rounded-full", s.color)} />
                  {s.label}
                </span>
                <span className="font-semibold text-neutral-800">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {tasks && stats.total > 0 && (
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-neutral-100">
          {stats.byStatus.map((s) =>
            s.count > 0 ? (
              <div key={s.status} className={cn("h-full transition-all", s.color)} style={{ width: `${(s.count / stats.total) * 100}%` }} />
            ) : null
          )}
        </div>
      )}

      {timeline && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-neutral-500">Temps écoulé</span>
            <span className={cn("font-medium", timeline.daysLeft < 0 ? "text-rose-600" : "text-neutral-700")}>
              {timeline.daysLeft >= 0
                ? `${timeline.daysLeft} jour${timeline.daysLeft !== 1 ? "s" : ""} restant${timeline.daysLeft !== 1 ? "s" : ""}`
                : `Échéance dépassée de ${-timeline.daysLeft} j`}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={cn("h-full rounded-full transition-all", behindSchedule ? "bg-amber-500" : "bg-sky-500")}
              style={{ width: `${timeline.pct}%` }}
            />
          </div>
          {behindSchedule && (
            <p className="mt-1.5 text-xs text-amber-700">
              {timeline.pct}% du délai consommé pour {stats.pct}% des tâches terminées.
            </p>
          )}
        </div>
      )}
    </SidebarSection>
  );
}

function TeamSection({ project }: { project: Project }) {
  return (
    <SidebarSection title={`Équipe (${project.members.length})`}>
      <ul className="space-y-1">
        {project.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2.5 px-1.5 py-1">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
              {initials(m.user.first_name, m.user.last_name)}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">
              {m.user.first_name} {m.user.last_name}
            </span>
          </li>
        ))}
        {project.members.length === 0 && (
          <li className="text-xs text-neutral-400">Aucun membre — ajoutez-en via « Modifier le projet ».</li>
        )}
      </ul>
    </SidebarSection>
  );
}

type PhaseStatus = "upcoming" | "active" | "late" | "done" | "empty";

const PHASE_STATUS_META: Record<PhaseStatus, { label: string; badge: string }> = {
  upcoming: { label: "À venir", badge: "bg-sky-100 text-sky-700" },
  active: { label: "En cours", badge: "bg-indigo-100 text-indigo-700" },
  late: { label: "En retard", badge: "bg-rose-100 text-rose-700" },
  done: { label: "Terminée", badge: "bg-emerald-100 text-emerald-700" },
  empty: { label: "Aucune tâche", badge: "bg-neutral-100 text-neutral-500" },
};

function toDay(value: string) {
  return new Date(`${value}T00:00:00`).getTime();
}

/** Terminée = toutes ses tâches faites ; sinon le calendrier tranche :
 * à venir avant le début, en retard après la fin, en cours entre les deux. */
function phaseStatus(phase: Epic, done: number, total: number, today: number): PhaseStatus {
  if (total > 0 && done === total) return "done";
  if (phase.end_date && toDay(phase.end_date) < today) return total === 0 ? "empty" : "late";
  if (phase.start_date && toDay(phase.start_date) > today) return "upcoming";
  return total === 0 ? "empty" : "active";
}

/** Phases du projet (modèle Epic côté API) : chacune regroupe des tâches
 * sur une période. On y lit l'avancement et si la phase est terminée. */
function PhasesSection({
  projectId,
  tasks,
  onChange,
}: {
  projectId: string;
  tasks: ProjectTask[] | null;
  onChange: () => void;
}) {
  const [phases, setPhases] = useState<Epic[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  });

  useEffect(() => {
    listEpics(projectId).then(setPhases).catch(() => setPhases([]));
  }, [projectId]);

  const rows = useMemo(() => {
    if (!phases) return [];
    return phases.map((phase) => {
      const phaseTasks = tasks?.filter((t) => t.epic === phase.id) ?? [];
      const done = phaseTasks.filter((t) => t.status === "DONE").length;
      const total = phaseTasks.length;
      return {
        phase,
        done,
        total,
        pct: total > 0 ? Math.round((done / total) * 100) : 0,
        status: phaseStatus(phase, done, total, today),
        daysLeft: phase.end_date ? Math.round((toDay(phase.end_date) - today) / DAY_MS) : null,
      };
    });
  }, [phases, tasks, today]);

  const counts = rows.reduce<Record<PhaseStatus, number>>(
    (acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }),
    { upcoming: 0, active: 0, late: 0, done: 0, empty: 0 }
  );
  const unassigned = tasks?.filter((t) => !t.epic).length ?? 0;

  async function handleCreate(data: { title: string; color: string; start_date: string; end_date: string }) {
    setSaving(true);
    setError(null);
    try {
      const phase = await createEpic(projectId, data);
      setPhases((prev) => [...(prev ?? []), phase].sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "")));
      setAdding(false);
      onChange();
    } catch {
      setError("Impossible d'ajouter cette phase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(phaseId: string, data: { title: string; color: string; start_date: string; end_date: string }) {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateEpic(projectId, phaseId, data);
      setPhases((prev) =>
        (prev ?? []).map((p) => (p.id === phaseId ? updated : p)).sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""))
      );
      setEditingId(null);
      onChange();
    } catch {
      setError("Impossible de modifier cette phase.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(phase: Epic) {
    if (!confirm(`Supprimer la phase « ${phase.title} » ? Ses tâches sont conservées, sans phase.`)) return;
    setPhases((prev) => prev?.filter((p) => p.id !== phase.id) ?? prev);
    try {
      await deleteEpic(projectId, phase.id);
      onChange();
    } catch {
      setError("Impossible de supprimer cette phase.");
      listEpics(projectId).then(setPhases).catch(() => {});
    }
  }

  return (
    <SidebarSection
      title={`Phases du projet${phases ? ` (${phases.length})` : ""}`}
      action={
        !adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setEditingId(null); }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Plus className="size-3.5" /> Nouvelle phase
          </button>
        )
      }
    >
      {adding && (
        <div className="mb-4">
          <PhaseForm submitLabel="Créer la phase" saving={saving} onSubmit={handleCreate} onCancel={() => setAdding(false)} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {(["done", "active", "late", "upcoming"] as PhaseStatus[])
            .filter((st) => counts[st] > 0)
            .map((st) => (
              <span key={st} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PHASE_STATUS_META[st].badge)}>
                {counts[st]} {PHASE_STATUS_META[st].label.toLowerCase()}
              </span>
            ))}
        </div>
      )}

      {!phases ? (
        <Loader2 className="size-5 animate-spin text-neutral-400" />
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ phase, done, total, pct, status, daysLeft }) =>
            editingId === phase.id ? (
              <li key={phase.id}>
                <PhaseForm
                  initial={phase}
                  submitLabel="Enregistrer"
                  saving={saving}
                  onSubmit={(data) => handleUpdate(phase.id, data)}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li key={phase.id} className="group rounded-xl border border-neutral-200 p-3">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: phase.color }} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">{phase.title}</span>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", PHASE_STATUS_META[status].badge)}>
                    {PHASE_STATUS_META[status].label}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-neutral-500">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="size-3.5 text-neutral-400" />
                    {phase.start_date && phase.end_date
                      ? `${formatShortDate(phase.start_date)} → ${formatShortDate(phase.end_date)}`
                      : "Période non définie"}
                  </span>
                  {daysLeft !== null && status !== "done" && (
                    <span className={cn(daysLeft < 0 && "font-medium text-rose-600")}>
                      {daysLeft > 0
                        ? `${daysLeft} j restant${daysLeft > 1 ? "s" : ""}`
                        : daysLeft === 0
                          ? "Se termine aujourd'hui"
                          : `Dépassée de ${-daysLeft} j`}
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: phase.color }} />
                  </div>
                  <span className="shrink-0 text-xs font-medium text-neutral-700">
                    {done}/{total} · {pct}%
                  </span>
                </div>

                <div className="mt-2 flex justify-end gap-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => { setEditingId(phase.id); setAdding(false); }}
                    className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900"
                  >
                    <Pencil className="size-3" /> Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(phase)}
                    className="flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-destructive"
                  >
                    <Trash2 className="size-3" /> Supprimer
                  </button>
                </div>
              </li>
            )
          )}
          {rows.length === 0 && !adding && (
            <li className="text-xs text-neutral-400">
              Aucune phase pour l&apos;instant — découpez le projet en grandes étapes (Conception, Développement…),
              chacune avec sa période.
            </li>
          )}
        </ul>
      )}

      {unassigned > 0 && rows.length > 0 && (
        <p className="mt-3 text-xs text-neutral-400">
          {unassigned} tâche{unassigned !== 1 ? "s" : ""} sans phase — rattachez-les depuis le détail de la tâche.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </SidebarSection>
  );
}

function DescriptionSection({ html }: { html: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <SidebarSection title="Description">
      <div
        className={cn(
          "prose-sm max-w-none text-sm text-neutral-700 [&_a]:text-primary [&_a]:underline [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
          !expanded && "line-clamp-6"
        )}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {expanded ? "Réduire" : "Lire la suite"}
        <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
      </button>
    </SidebarSection>
  );
}

function ProjectSidebar({
  project,
  tasks,
  onChange,
}: {
  project: Project;
  tasks: ProjectTask[] | null;
  onChange: () => void;
}) {
  const [view, setView] = useState<SidebarView>("apercu");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  return (
    // Panneau fixe à gauche, pleine hauteur sous l'en-tête admin (h-16) —
    // la sidebar admin est masquée sur cette route (admin-shell.tsx), ce
    // panneau prend sa place. Sur mobile il s'empile au-dessus du tableau.
    <aside className="w-full shrink-0 overflow-x-hidden border-b border-neutral-200 bg-white md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:w-96 md:overflow-y-auto md:border-r md:border-b-0 xl:w-[30rem]">
      <AnimatePresence mode="wait" initial={false}>
      {editing ? (
        <motion.div key="edit" {...SLIDE} className="px-5 py-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="group inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
              Retour au projet
            </button>
            <h2 className="text-sm font-semibold text-neutral-900">Modifier le projet</h2>
          </div>
          <EditProjectForm
            project={project}
            onCancel={() => {
              // L'équipe, les étiquettes et les sprints s'enregistrent à la
              // volée : même sans « Enregistrer », la barre doit les refléter.
              setEditing(false);
              onChange();
            }}
            onSaved={() => {
              setEditing(false);
              onChange();
            }}
          />
        </motion.div>
      ) : (
      <motion.div key="view" {...SLIDE}>
      <div className="px-5 pt-5 pb-4">
        <Link
          href="/admin/technique/projets"
          className="group mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Tous les projets
        </Link>

        {project.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.cover_image_url} alt="" className="mb-3 h-28 w-full rounded-xl object-cover" />
        )}

        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold leading-snug text-neutral-900">{project.name}</h1>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            <Pencil className="size-3.5" /> Modifier le projet
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[project.status])}>
            {STATUS_LABELS[project.status]}
          </span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", PRIORITY_COLORS[project.priority])}>
            Priorité {PRIORITY_LABELS[project.priority]}
          </span>
        </div>
      </div>

      <nav className="mx-5 mb-4 flex gap-1 rounded-xl bg-neutral-100 p-1">
        {VIEWS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              view === value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      {view === "phases" ? (
        <PhasesSection projectId={project.id} tasks={tasks} onChange={onChange} />
      ) : (
      <>
      <ProgressSection project={project} tasks={tasks} />

      {/* Petit écran : barre empilée au-dessus du tableau — les détails
       * sont repliés pour ne pas occuper tout l'écran avant les tâches. */}
      <button
        type="button"
        onClick={() => setDetailsOpen((v) => !v)}
        className="flex w-full items-center justify-between border-t border-neutral-100 px-5 py-3 text-sm font-medium text-neutral-700 md:hidden"
      >
        {detailsOpen ? "Masquer les détails du projet" : "Voir les détails du projet"}
        <ChevronDown className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} />
      </button>

      <div className={cn(!detailsOpen && "hidden", "md:block")}>
      <SidebarSection title="Détails">
        <DetailRow icon={Shield} label="Chef de projet">
          {project.lead_project_manager
            ? `${project.lead_project_manager.first_name} ${project.lead_project_manager.last_name}`
            : "Non assigné"}
        </DetailRow>
        <DetailRow icon={Building2} label="Client">
          {project.client ? (
            <Link href={`/admin/rh/clients/${project.client.id}`} className="text-primary hover:underline">
              {project.client.company_name}
            </Link>
          ) : (
            <span className="text-neutral-400">Aucun client rattaché</span>
          )}
        </DetailRow>
        <DetailRow icon={CalendarDays} label="Période">
          {formatDate(project.start_date)} → {formatDate(project.end_date)}
        </DetailRow>
        <DetailRow icon={Wallet} label="Budget">
          {project.budget ? formatFcfa(project.budget) : <span className="text-neutral-400">—</span>}
        </DetailRow>
        {project.category && (
          <DetailRow icon={Tag} label="Catégorie">
            {project.category}
          </DetailRow>
        )}
      </SidebarSection>

      <TeamSection project={project} />

      {project.description && <DescriptionSection html={project.description} />}
      </div>
      </>
      )}
      </motion.div>
      )}
      </AnimatePresence>
    </aside>
  );
}

export function ProjectDetail({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Phases, étiquettes et sprints se modifient hors du tableau (barre
  // latérale, formulaire du projet) : le tableau recharge ses listes quand
  // cette clé change.
  const [boardRefreshKey, setBoardRefreshKey] = useState(0);

  async function load() {
    try {
      setProject(await getProject(id));
    } catch {
      setError("Impossible de charger ce projet (accès refusé ou introuvable).");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/technique/projets"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" /> Retour aux projets
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    // Marges négatives : annule le padding de <main> (admin-shell.tsx) pour
    // que la barre latérale colle au bord gauche et au bas de l'écran.
    <div className="-mx-6 -mt-8 -mb-28 flex min-h-[calc(100dvh-4rem)] flex-col md:flex-row lg:-mx-10 lg:-mb-8">
      <ProjectSidebar
        project={project}
        tasks={tasks}
        onChange={() => {
          load();
          setBoardRefreshKey((k) => k + 1);
        }}
      />

      <div className="relative isolate min-w-0 flex-1 px-4 pt-6 pb-28 md:px-6 lg:px-8 lg:pb-8">
        <AmbientVideoBackground />
        <ProjectTaskBoard project={project} refreshKey={boardRefreshKey} onTasksChange={setTasks} />
      </div>
    </div>
  );
}
