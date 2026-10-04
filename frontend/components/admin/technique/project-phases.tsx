"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { listEpics, createEpic, updateEpic, deleteEpic } from "@/lib/api/projects";
import type { Epic } from "@/lib/api/types";

// Phases du projet (modèle « Epic » côté API) : formulaire partagé par la
// barre latérale du détail projet et les formulaires de création/modification.

export const PHASE_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#ef4444"];

export function formatShortDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export function PhaseForm({
  initial,
  submitLabel,
  saving,
  onSubmit,
  onCancel,
}: {
  initial?: { title: string; color: string; start_date: string | null; end_date: string | null };
  submitLabel: string;
  saving: boolean;
  onSubmit: (data: { title: string; color: string; start_date: string; end_date: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState(initial?.color ?? PHASE_COLORS[0]);
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");

  const datesInvalid = Boolean(startDate && endDate && endDate < startDate);
  const canSubmit = Boolean(title.trim() && startDate && endDate && !datesInvalid);

  function submit() {
    if (canSubmit && !saving) onSubmit({ title: title.trim(), color, start_date: startDate, end_date: endDate });
  }

  return (
    // Pas de <form> : ce bloc vit aussi dans le formulaire du projet. Entrée
    // valide la phase au lieu d'envoyer le formulaire parent.
    <div
      className="space-y-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-3"
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          submit();
        }
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Nom de la phase (ex. Conception)"
        className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-800 focus:border-primary/50 focus:outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-neutral-500">Début</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-800 focus:border-primary/50 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-neutral-500">Fin</span>
          <input
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-800 focus:border-primary/50 focus:outline-none"
          />
        </label>
      </div>
      {datesInvalid && <p className="text-xs text-destructive">La fin doit être après le début.</p>}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {PHASE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="size-5 rounded-full border-2"
              style={{ backgroundColor: c, borderColor: color === c ? "#111827" : "transparent" }}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={submit}
            className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type PhaseInput = { title: string; color: string; start_date: string; end_date: string };

function sortByStart<T extends { start_date: string | null }>(items: T[]) {
  return [...items].sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
}

function PhaseRow({
  phase,
  onEdit,
  onDelete,
}: {
  phase: { title: string; color: string; start_date: string | null; end_date: string | null };
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg bg-neutral-50 px-2.5 py-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: phase.color }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-neutral-800">{phase.title}</span>
        <span className="block text-xs text-neutral-500">
          {phase.start_date && phase.end_date
            ? `${formatShortDate(phase.start_date)} → ${formatShortDate(phase.end_date)}`
            : "Période non définie"}
        </span>
      </span>
      {onEdit && (
        <button type="button" onClick={onEdit} className="shrink-0 text-neutral-400 hover:text-neutral-800" aria-label={`Modifier ${phase.title}`}>
          <Pencil className="size-3.5" />
        </button>
      )}
      <button type="button" onClick={onDelete} className="shrink-0 text-neutral-400 hover:text-destructive" aria-label={`Supprimer ${phase.title}`}>
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

/** Phases d'un projet existant, dans le formulaire de modification —
 * enregistrées à chaque ajout/modification/suppression, comme l'équipe. */
export function PhasesEditor({ projectId }: { projectId: string }) {
  const [phases, setPhases] = useState<Epic[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEpics(projectId).then(setPhases).catch(() => setPhases([]));
  }, [projectId]);

  async function run(action: () => Promise<void>, failure: string) {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch {
      setError(failure);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs text-neutral-500">Phases du projet ({phases?.length ?? 0}) — enregistrées dès chaque changement</span>
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setEditingId(null); }}
            className="flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Nouvelle phase
          </button>
        )}
      </div>
      {adding && (
        <PhaseForm
          submitLabel="Créer la phase"
          saving={saving}
          onCancel={() => setAdding(false)}
          onSubmit={(data) =>
            run(async () => {
              const phase = await createEpic(projectId, data);
              setPhases((prev) => sortByStart([...(prev ?? []), phase]));
              setAdding(false);
            }, "Impossible d'ajouter cette phase.")
          }
        />
      )}
      {!phases ? (
        <Loader2 className="size-4 animate-spin text-neutral-400" />
      ) : (
        <ul className="space-y-1.5">
          {phases.map((phase) =>
            editingId === phase.id ? (
              <li key={phase.id}>
                <PhaseForm
                  initial={phase}
                  submitLabel="Enregistrer"
                  saving={saving}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(data) =>
                    run(async () => {
                      const updated = await updateEpic(projectId, phase.id, data);
                      setPhases((prev) => sortByStart((prev ?? []).map((p) => (p.id === phase.id ? updated : p))));
                      setEditingId(null);
                    }, "Impossible de modifier cette phase.")
                  }
                />
              </li>
            ) : (
              <PhaseRow
                key={phase.id}
                phase={phase}
                onEdit={() => { setEditingId(phase.id); setAdding(false); }}
                onDelete={() => {
                  if (!confirm(`Supprimer la phase « ${phase.title} » ? Ses tâches sont conservées, sans phase.`)) return;
                  run(async () => {
                    await deleteEpic(projectId, phase.id);
                    setPhases((prev) => prev?.filter((p) => p.id !== phase.id) ?? prev);
                  }, "Impossible de supprimer cette phase.");
                }}
              />
            )
          )}
          {phases.length === 0 && !adding && <li className="text-xs text-neutral-400">Aucune phase pour l&apos;instant.</li>}
        </ul>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Phases saisies avant que le projet existe — créées juste après lui. */
export function PendingPhasesEditor({ phases, onChange }: { phases: PhaseInput[]; onChange: (phases: PhaseInput[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs text-neutral-500">Phases du projet ({phases.length})</span>
        {!adding && (
          <button
            type="button"
            onClick={() => { setAdding(true); setEditingIndex(null); }}
            className="flex shrink-0 items-center gap-1 text-xs font-medium whitespace-nowrap text-primary hover:underline"
          >
            <Plus className="size-3.5" /> Nouvelle phase
          </button>
        )}
      </div>
      {adding && (
        <PhaseForm
          submitLabel="Ajouter"
          saving={false}
          onCancel={() => setAdding(false)}
          onSubmit={(data) => {
            onChange(sortByStart([...phases, data]));
            setAdding(false);
          }}
        />
      )}
      <ul className="space-y-1.5">
        {phases.map((phase, i) =>
          editingIndex === i ? (
            <li key={`${phase.title}-${i}`}>
              <PhaseForm
                initial={phase}
                submitLabel="Valider"
                saving={false}
                onCancel={() => setEditingIndex(null)}
                onSubmit={(data) => {
                  onChange(sortByStart(phases.map((p, j) => (j === i ? data : p))));
                  setEditingIndex(null);
                }}
              />
            </li>
          ) : (
            <PhaseRow
              key={`${phase.title}-${i}`}
              phase={phase}
              onEdit={() => { setEditingIndex(i); setAdding(false); }}
              onDelete={() => onChange(phases.filter((_, j) => j !== i))}
            />
          )
        )}
        {phases.length === 0 && !adding && (
          <li className="text-xs text-neutral-400">Découpez le projet en grandes étapes, chacune avec sa période.</li>
        )}
      </ul>
    </div>
  );
}
