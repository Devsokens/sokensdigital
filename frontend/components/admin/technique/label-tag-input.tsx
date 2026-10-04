"use client";

import { useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const LABEL_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#0ea5e9", "#ef4444"];

/** Couleur attribuée d'office : la saisie reste un simple champ, sans
 * palette à choisir. */
export function nextLabelColor(existingCount: number) {
  return LABEL_COLORS[existingCount % LABEL_COLORS.length];
}

type Chip = { key: string; name: string; color: string };

function LabelChip({ chip, onRemove, removeLabel }: { chip: Chip; onRemove?: () => void; removeLabel: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-xs font-medium"
      style={{ backgroundColor: `${chip.color}1a`, color: chip.color }}
    >
      {chip.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label={`${removeLabel} ${chip.name}`}
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** Pastilles + petit champ en ligne. Entrée valide la saisie ; le parent
 * décide de ce qu'elle produit (création, sélection…). Pas de <form> :
 * ce bloc vit aussi dans d'autres formulaires, Entrée ne doit pas les
 * envoyer. */
function ChipField({
  chips,
  onRemove,
  removeLabel,
  onSubmit,
  placeholder,
  busy,
  suggestions,
  backspaceRemoves = false,
}: {
  chips: Chip[];
  onRemove: (key: string) => void;
  removeLabel: string;
  onSubmit: (text: string) => Promise<void> | void;
  placeholder: string;
  busy?: boolean;
  suggestions?: (query: string) => { key: string; name: string; color: string }[];
  /** Retour arrière sur un champ vide retire la dernière pastille — pour
   * une sélection seulement, jamais pour une suppression définitive. */
  backspaceRemoves?: boolean;
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(value: string) {
    const name = value.trim();
    if (!name || busy) return;
    setText("");
    await onSubmit(name);
    inputRef.current?.focus();
  }

  const options = suggestions && focused ? suggestions(text.trim()) : [];

  // Largeur ajustée au contenu (pastilles + petit champ), pas pleine largeur.
  return (
    <div className="relative inline-block max-w-full align-top">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "inline-flex min-h-9 max-w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1 transition-colors",
          focused ? "border-primary/50" : "border-neutral-200"
        )}
      >
        {chips.map((chip) => (
          <LabelChip key={chip.key} chip={chip} removeLabel={removeLabel} onRemove={() => onRemove(chip.key)} />
        ))}
        <span className="inline-flex items-center gap-1 text-neutral-400">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                submit(text);
              } else if (backspaceRemoves && e.key === "Backspace" && !text && chips.length > 0) {
                onRemove(chips[chips.length - 1].key);
              } else if (e.key === "Escape") {
                setText("");
                inputRef.current?.blur();
              }
            }}
            placeholder={placeholder}
            className="w-24 bg-transparent py-0.5 text-xs text-neutral-800 outline-none placeholder:text-neutral-400"
          />
        </span>
      </div>

      {options.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg">
          {options.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => submit(opt.name)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: opt.color }} />
              {opt.key.startsWith("new:") ? (
                <span>Créer « <strong>{opt.name}</strong> »</span>
              ) : (
                opt.name
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type LabelLike = { id?: string; name: string; color: string };

/** Les étiquettes d'un projet : toutes affichées, chacune supprimable ;
 * taper un nom + Entrée la crée. */
export function LabelManager<T extends LabelLike>({
  labels,
  onCreate,
  onDelete,
  busy,
}: {
  labels: T[];
  onCreate: (name: string, color: string) => Promise<void> | void;
  onDelete: (label: T) => void;
  busy?: boolean;
}) {
  return (
    <ChipField
      chips={labels.map((l, i) => ({ key: l.id ?? `pending-${i}`, name: l.name, color: l.color }))}
      removeLabel="Supprimer"
      onRemove={(key) => {
        const label = labels.find((l, i) => (l.id ?? `pending-${i}`) === key);
        if (label) onDelete(label);
      }}
      onSubmit={(name) => {
        if (labels.some((l) => l.name.toLowerCase() === name.toLowerCase())) return;
        return onCreate(name, nextLabelColor(labels.length));
      }}
      placeholder="Étiquette…"
      busy={busy}
    />
  );
}

/** Étiquettes d'une tâche : les sélectionnées en pastilles ; la saisie
 * propose celles du projet, ou crée la nouvelle et l'ajoute aussitôt. */
export function LabelPicker({
  available,
  selectedIds,
  onChange,
  onCreate,
}: {
  available: { id: string; name: string; color: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onCreate: (name: string, color: string) => Promise<{ id: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = selectedIds
    .map((id) => available.find((l) => l.id === id))
    .filter((l): l is { id: string; name: string; color: string } => Boolean(l));

  async function handleSubmit(name: string) {
    setError(null);
    const existing = available.find((l) => l.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedIds.includes(existing.id)) onChange([...selectedIds, existing.id]);
      return;
    }
    setBusy(true);
    try {
      const created = await onCreate(name, nextLabelColor(available.length));
      onChange([...selectedIds, created.id]);
    } catch {
      setError("Impossible de créer cette étiquette.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ChipField
        chips={selected.map((l) => ({ key: l.id, name: l.name, color: l.color }))}
        removeLabel="Retirer"
        onRemove={(id) => onChange(selectedIds.filter((s) => s !== id))}
        onSubmit={handleSubmit}
        placeholder="Étiquette…"
        busy={busy}
        backspaceRemoves
        suggestions={(query) => {
          const q = query.toLowerCase();
          const matches = available
            .filter((l) => !selectedIds.includes(l.id) && l.name.toLowerCase().includes(q))
            .map((l) => ({ key: l.id, name: l.name, color: l.color }));
          const exact = available.some((l) => l.name.toLowerCase() === q);
          if (query && !exact) {
            matches.push({ key: `new:${query}`, name: query, color: nextLabelColor(available.length) });
          }
          return matches;
        }}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
