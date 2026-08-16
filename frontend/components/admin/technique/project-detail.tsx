"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass, cardClass } from "@/components/admin/form-styles";
import { getProject, updateProject, addProjectMember, removeProjectMember } from "@/lib/api/projects";
import { listUsers } from "@/lib/api/hr";
import { ProjectTaskBoard } from "@/components/admin/technique/project-task-board";
import type { Project, ProjectStatus, UserBrief } from "@/lib/api/types";

const STATUS_OPTIONS: ProjectStatus[] = ["EN_COURS", "EN_PAUSE", "TERMINE", "ANNULE"];
const STATUS_LABELS: Record<ProjectStatus, string> = {
  EN_COURS: "En cours",
  EN_PAUSE: "En pause",
  TERMINE: "Terminé",
  ANNULE: "Annulé",
};

type Tab = "tasks" | "settings";

export function ProjectDetail({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("tasks");

  async function load() {
    try {
      setProject(await getProject(id));
    } catch {
      setError("Impossible de charger ce projet (accès refusé ou introuvable).");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!project) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-neutral-900">{project.name}</h1>
        <p className="text-sm text-neutral-500">
          Dirigé par {project.lead_project_manager ? `${project.lead_project_manager.first_name} ${project.lead_project_manager.last_name}` : "—"}
        </p>
      </div>

      <div className="mb-5 flex items-center gap-1 border-b border-neutral-200">
        {([
          { key: "tasks", label: "Tâches" },
          { key: "settings", label: "Paramètres" },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tasks" ? (
        <ProjectTaskBoard project={project} />
      ) : (
        <div className="max-w-2xl space-y-8">
          <ProjectForm project={project} onSaved={load} />
          <MembersSection project={project} onSaved={load} />
        </div>
      )}
    </div>
  );
}

function ProjectForm({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [name, setName] = useState(project.name);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [startDate, setStartDate] = useState(project.start_date ?? "");
  const [endDate, setEndDate] = useState(project.end_date ?? "");
  const [budget, setBudget] = useState(project.budget ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateProject(project.id, {
        name, status, start_date: startDate || undefined, end_date: endDate || undefined, budget: budget || undefined,
      });
      onSaved();
    } catch {
      setError("Impossible d'enregistrer les modifications.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${cardClass}`}>
      <h2 className="text-sm font-semibold text-neutral-900">Détails du projet</h2>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <label className="block">
        <span className={labelClass}>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Statut</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={inputClass}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelClass}>Budget</span>
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Date de début</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Date de fin</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </label>
      </div>
      <Button type="submit" disabled={saving} className="rounded-full px-5">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
      </Button>
    </form>
  );
}

function MembersSection({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listUsers().then((data) => setUsers(data.results)).catch(() => setUsers([]));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setError(null);
    setBusy(true);
    try {
      await addProjectMember(project.id, selectedUserId);
      setSelectedUserId("");
      onSaved();
    } catch {
      setError("Impossible d'ajouter ce membre.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(membershipId: string) {
    setBusy(true);
    try {
      await removeProjectMember(project.id, membershipId);
      onSaved();
    } catch {
      setError("Impossible de retirer ce membre.");
    } finally {
      setBusy(false);
    }
  }

  const availableUsers = users.filter((u) => !project.members.some((m) => m.user.id === u.id));

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-neutral-900">Équipe</h2>
      {error && <p className="mb-2 text-xs text-destructive">{error}</p>}

      <form onSubmit={handleAdd} className="mb-4 flex items-end gap-3">
        <label className="block flex-1">
          <span className={labelClass}>Ajouter un membre</span>
          <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className={inputClass}>
            <option value="">— Choisir —</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={busy || !selectedUserId} className="gap-1 rounded-full px-4">
          <Plus className="size-4" /> Ajouter
        </Button>
      </form>

      <div className="space-y-2">
        {project.members.map((member) => (
          <div key={member.id} className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3 text-sm">
            <span className="text-neutral-900">{member.user.first_name} {member.user.last_name}</span>
            <button
              type="button"
              onClick={() => handleRemove(member.id)}
              disabled={busy}
              aria-label="Retirer"
              className="text-neutral-400 hover:text-destructive"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {project.members.length === 0 && <p className="text-sm text-neutral-400">Aucun membre pour l&apos;instant.</p>}
      </div>
    </div>
  );
}
