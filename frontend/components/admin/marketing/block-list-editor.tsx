"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import type { Block, Tone } from "@/lib/blog/types";

const BLOCK_LABELS: Record<Block["type"], string> = {
  p: "Paragraphe",
  h2: "Titre H2",
  h3: "Titre H3",
  code: "Bloc de code",
  table: "Tableau",
  compare: "Comparaison",
  callout: "Encadré",
};

const TONES: Tone[] = ["medium", "high", "critical"];

function blank(type: Block["type"]): Block {
  switch (type) {
    case "p":
      return { type: "p", text: "" };
    case "h2":
      return { type: "h2", text: "" };
    case "h3":
      return { type: "h3", text: "", center: false };
    case "code":
      return { type: "code", filename: "", code: "" };
    case "table":
      return { type: "table", headers: ["Colonne 1", "Colonne 2"], rows: [{ cells: ["", ""] }] };
    case "compare":
      return {
        type: "compare",
        left: { title: "", description: "", accent: "cyan" },
        right: { title: "", description: "", accent: "amber" },
      };
    case "callout":
      return { type: "callout", icon: "shield-check", title: "", description: "" };
  }
}

/** A block-by-block editor for BlogPost.content — the article body as
 * structured JSON blocks (mirrors ArticleContent's renderer exactly), not
 * a raw HTML/JSON textarea. Same "no field left as an opaque blob"
 * principle as the project form's stats/solution_points array editors. */
export function BlockListEditor({ blocks, onChange }: { blocks: Block[]; onChange: (blocks: Block[]) => void }) {
  function update(index: number, block: Block) {
    onChange(blocks.map((b, i) => (i === index ? block : b)));
  }
  function remove(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function add(type: Block["type"]) {
    onChange([...blocks, blank(type)]);
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => (
        <div key={i} className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">
              {BLOCK_LABELS[block.type]}
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30">
                <ChevronUp className="size-3.5" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} className="rounded p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30">
                <ChevronDown className="size-3.5" />
              </button>
              <button type="button" onClick={() => remove(i)} className="rounded p-1 text-neutral-400 hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          <BlockFields block={block} onChange={(b) => update(i, b)} />
        </div>
      ))}

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(BLOCK_LABELS) as Block["type"][]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => add(type)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 hover:border-primary/40 hover:text-primary"
          >
            <Plus className="size-3" />
            {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

function BlockFields({ block, onChange }: { block: Block; onChange: (block: Block) => void }) {
  switch (block.type) {
    case "p":
      return (
        <textarea
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          className={cn(inputClass, "min-h-20")}
          placeholder="Texte du paragraphe"
        />
      );

    case "h2":
      return (
        <input
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          className={inputClass}
          placeholder="Titre de section"
        />
      );

    case "h3":
      return (
        <div className="space-y-2">
          <input
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            className={inputClass}
            placeholder="Sous-titre"
          />
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input type="checkbox" checked={block.center ?? false} onChange={(e) => onChange({ ...block, center: e.target.checked })} />
            Centré
          </label>
        </div>
      );

    case "code":
      return (
        <div className="space-y-2">
          <input
            value={block.filename}
            onChange={(e) => onChange({ ...block, filename: e.target.value })}
            className={inputClass}
            placeholder="nom_du_fichier.py"
          />
          <textarea
            value={block.code}
            onChange={(e) => onChange({ ...block, code: e.target.value })}
            className={cn(inputClass, "min-h-32 font-mono text-xs")}
            spellCheck={false}
            placeholder="Code source"
          />
        </div>
      );

    case "table":
      return (
        <div className="space-y-3">
          <label className="block">
            <span className={labelClass}>Colonnes (séparées par des virgules)</span>
            <input
              value={block.headers.join(", ")}
              onChange={(e) => onChange({ ...block, headers: e.target.value.split(",").map((h) => h.trim()) })}
              className={inputClass}
            />
          </label>
          <div className="space-y-2">
            {block.rows.map((row, ri) => (
              <div key={ri} className="flex items-center gap-2">
                <input
                  value={row.cells.join(", ")}
                  onChange={(e) => {
                    const rows = block.rows.map((r, i) => (i === ri ? { ...r, cells: e.target.value.split(",").map((c) => c.trim()) } : r));
                    onChange({ ...block, rows });
                  }}
                  className={inputClass}
                  placeholder="Cellules séparées par des virgules"
                />
                <select
                  value={row.tone ?? ""}
                  onChange={(e) => {
                    const rows = block.rows.map((r, i) => (i === ri ? { ...r, tone: (e.target.value || undefined) as Tone | undefined } : r));
                    onChange({ ...block, rows });
                  }}
                  className="rounded-lg border border-neutral-200 bg-white px-2 py-2.5 text-sm text-neutral-900"
                >
                  <option value="">Aucun badge</option>
                  {TONES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button type="button" onClick={() => onChange({ ...block, rows: block.rows.filter((_, i) => i !== ri) })} className="shrink-0 text-neutral-400 hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => onChange({ ...block, rows: [...block.rows, { cells: block.headers.map(() => "") }] })}
              className="text-xs font-medium text-primary hover:underline"
            >
              + Ajouter une ligne
            </button>
          </div>
        </div>
      );

    case "compare":
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["left", "right"] as const).map((side) => (
            <div key={side} className="space-y-2 rounded-lg border border-neutral-100 p-3">
              <span className={labelClass}>{side === "left" ? "Colonne gauche" : "Colonne droite"}</span>
              <input
                value={block[side].title}
                onChange={(e) => onChange({ ...block, [side]: { ...block[side], title: e.target.value } })}
                className={inputClass}
                placeholder="Titre"
              />
              <textarea
                value={block[side].description}
                onChange={(e) => onChange({ ...block, [side]: { ...block[side], description: e.target.value } })}
                className={cn(inputClass, "min-h-16")}
                placeholder="Description"
              />
              <select
                value={block[side].accent}
                onChange={(e) => onChange({ ...block, [side]: { ...block[side], accent: e.target.value as "cyan" | "amber" } })}
                className="rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                <option value="cyan">Cyan</option>
                <option value="amber">Ambre</option>
              </select>
            </div>
          ))}
        </div>
      );

    case "callout":
      return (
        <div className="space-y-2">
          <input
            value={block.icon}
            onChange={(e) => onChange({ ...block, icon: e.target.value })}
            className={inputClass}
            placeholder="Icône (ex: shield-check)"
          />
          <input
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            className={inputClass}
            placeholder="Titre"
          />
          <textarea
            value={block.description}
            onChange={(e) => onChange({ ...block, description: e.target.value })}
            className={cn(inputClass, "min-h-16")}
            placeholder="Description"
          />
        </div>
      );
  }
}
