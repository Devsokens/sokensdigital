"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { inputClass } from "@/components/admin/form-styles";
import {
  listLabels, createLabel, deleteLabel,
  listSprints, createSprint, deleteSprint,
} from "@/lib/api/projects";
import type { Label, Sprint } from "@/lib/api/types";

const LABEL_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9", "#ef4444"];

export function LabelsPanel({ projectId }: { projectId: string }) {
  const [labels, setLabels] = useState<Label[] | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listLabels(projectId).then(setLabels).catch(() => setLabels([]));
  }, [projectId]);

  async function handleAdd() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const label = await createLabel(projectId, { name: name.trim(), color });
      setLabels((prev) => (prev ? [...prev, label] : [label]));
      setName("");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(label: Label) {
    setLabels((prev) => prev?.filter((l) => l.id !== label.id) ?? prev);
    await deleteLabel(projectId, label.id);
  }

  if (!labels) return <Loader2 className="size-5 animate-spin text-neutral-400" />;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-neutral-900">Étiquettes</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <span
            key={label.id}
            className="group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{ backgroundColor: `${label.color}1a`, color: label.color }}
          >
            {label.name}
            <button type="button" onClick={() => handleDelete(label)} className="opacity-50 hover:opacity-100">
              <Trash2 className="size-3" />
            </button>
          </span>
        ))}
        {labels.length === 0 && <p className="text-xs text-neutral-400">Aucune étiquette pour l&apos;instant.</p>}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          {LABEL_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="size-6 shrink-0 rounded-full border-2"
              style={{ backgroundColor: c, borderColor: color === c ? "#111827" : "transparent" }}
            />
          ))}
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
          placeholder="Nom de l'étiquette…"
          className={inputClass}
        />
        <button type="button" onClick={handleAdd} disabled={!name.trim() || saving} className="shrink-0 rounded-lg border border-neutral-200 px-3 py-2.5 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
          <Plus className="size-3.5" />
        </button>
      </div>
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
