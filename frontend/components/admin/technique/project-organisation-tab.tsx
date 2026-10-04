"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { LabelManager } from "@/components/admin/technique/label-tag-input";
import {
  listLabels, createLabel, deleteLabel,
  listSprints, createSprint, deleteSprint,
} from "@/lib/api/projects";
import type { Label, Sprint } from "@/lib/api/types";

/** Étiquettes d'un projet existant (formulaire de modification) :
 * enregistrées dès la saisie, supprimées depuis leur pastille. */
export function LabelsPanel({ projectId }: { projectId: string }) {
  const [labels, setLabels] = useState<Label[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLabels(projectId).then(setLabels).catch(() => setLabels([]));
  }, [projectId]);

  async function handleCreate(name: string, color: string) {
    setSaving(true);
    setError(null);
    try {
      const label = await createLabel(projectId, { name, color });
      setLabels((prev) => (prev?.some((l) => l.id === label.id) ? prev : [...(prev ?? []), label]));
    } catch {
      setError("Impossible d'ajouter cette étiquette.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(label: Label) {
    if (!confirm(`Supprimer l'étiquette « ${label.name} » ? Elle sera retirée de toutes les tâches.`)) return;
    setError(null);
    setLabels((prev) => prev?.filter((l) => l.id !== label.id) ?? prev);
    try {
      await deleteLabel(projectId, label.id);
    } catch {
      setError("Impossible de supprimer cette étiquette.");
      listLabels(projectId).then(setLabels).catch(() => {});
    }
  }

  if (!labels) return <Loader2 className="size-5 animate-spin text-neutral-400" />;

  return (
    <div>
      <span className={labelClass}>Étiquettes</span>
      <LabelManager labels={labels} onCreate={handleCreate} onDelete={handleDelete} busy={saving} />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function SprintsPanel({ projectId }: { projectId: string }) {
  const [sprints, setSprints] = useState<Sprint[] | null>(null);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listSprints(projectId).then(setSprints).catch(() => setSprints([]));
  }, [projectId]);

  async function handleAdd() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const sprint = await createSprint(projectId, { name: name.trim(), start_date: startDate || null, end_date: endDate || null });
      setSprints((prev) => (prev ? [...prev, sprint] : [sprint]));
      setName("");
      setStartDate("");
      setEndDate("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(sprint: Sprint) {
    setSprints((prev) => prev?.filter((s) => s.id !== sprint.id) ?? prev);
    await deleteSprint(projectId, sprint.id);
  }

  if (!sprints) return <Loader2 className="size-5 animate-spin text-neutral-400" />;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-neutral-900">Sprints</p>
      <div className="mb-3 space-y-1.5">
        {sprints.map((sprint) => (
          <div key={sprint.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            <span>
              {sprint.name}
              {(sprint.start_date || sprint.end_date) && (
                <span className="ml-2 text-xs text-neutral-400">
                  {sprint.start_date ?? "…"} → {sprint.end_date ?? "…"}
                </span>
              )}
            </span>
            <button type="button" onClick={() => handleDelete(sprint)} className="text-neutral-400 hover:text-destructive">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {sprints.length === 0 && <p className="text-xs text-neutral-400">Aucun sprint pour l&apos;instant.</p>}
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Nom du sprint…"
          className={`${inputClass} col-span-3`}
        />
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        <button type="button" onClick={handleAdd} disabled={!name.trim() || saving} className="shrink-0 rounded-lg border border-neutral-200 px-3 py-2.5 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
