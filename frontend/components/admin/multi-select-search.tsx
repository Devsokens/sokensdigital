"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectSearchOption = { id: string; label: string; sublabel?: string };

/** Ferme le menu au clic extérieur ou à Échap — remplace ce qu'un Popover en
 * portail donnerait gratuitement, sans les problèmes de portail (voir
 * useDropdown ci-dessous). */
function useOutsideClose(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handlePointer(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);
  return ref;
}

/** Select avec barre de recherche, en mode single ou multi — aucun
 * composant de ce type n'existait dans le repo. Écrit sans Popover
 * (base-ui) volontairement : ce composant s'utilise à l'intérieur d'un
 * Sheet ou d'une Modal (eux-mêmes des Dialog base-ui), et le Popover rend
 * son contenu dans un portail au niveau du document — le piège de focus du
 * Dialog parent marque alors ce portail (un frère du Dialog dans le DOM)
 * comme inerte, rendant le menu invisible ou totalement inutilisable
 * (clics/saisie ignorés) une fois imbriqué. Un menu positionné en local
 * (absolute, sans portail) reste dans le sous-arbre du Dialog et n'est
 * jamais affecté par son piège de focus. */
function useDropdown() {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useOutsideClose(open, () => setOpen(false));

  function openMenu() {
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return { open, setOpen, openMenu, inputRef, containerRef };
}

export function SelectSearch({
  options,
  value,
  onChange,
  placeholder = "— Sélectionner —",
  emptyLabel = "Aucun résultat.",
}: {
  options: SelectSearchOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const { open, setOpen, openMenu, inputRef, containerRef } = useDropdown();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            setQuery("");
            openMenu();
          }
        }}
        className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-colors hover:border-neutral-300"
      >
        <span className={selected ? "text-neutral-900" : "text-neutral-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="size-4 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1.5 rounded-xl border border-neutral-200 bg-white shadow-xl shadow-black/5">
          <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
            <Search className="size-3.5 shrink-0 text-neutral-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="w-full bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {filtered.length === 0 && (
              <p className="px-2.5 py-2 text-xs text-neutral-400">{emptyLabel}</p>
            )}
            {filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option.id === value ? null : option.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-neutral-50",
                  option.id === value && "bg-primary/5 text-primary"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-neutral-800">{option.label}</span>
                  {option.sublabel && (
                    <span className="block truncate text-xs text-neutral-400">{option.sublabel}</span>
                  )}
                </span>
                {option.id === value && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Même principe, plusieurs sélections possibles — chips retirables
 * au-dessus du champ de recherche. */
export function MultiSelectSearch({
  options,
  values,
  onChange,
  placeholder = "Rechercher et ajouter…",
  emptyLabel = "Aucun résultat.",
}: {
  options: SelectSearchOption[];
  values: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const { open, setOpen, openMenu, inputRef, containerRef } = useDropdown();
  const [query, setQuery] = useState("");

  const selectedSet = new Set(values);
  const selectedOptions = options.filter((o) => selectedSet.has(o.id));
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => !selectedSet.has(o.id) && (!q || o.label.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, query, values]);

  function toggle(id: string) {
    onChange([...values, id]);
  }

  function remove(id: string) {
    onChange(values.filter((v) => v !== id));
  }

  return (
    <div className="space-y-2">
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedOptions.map((option) => (
            <span
              key={option.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              {option.label}
              <button type="button" onClick={() => remove(option.id)} aria-label={`Retirer ${option.label}`}>
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false);
            } else {
              setQuery("");
              openMenu();
            }
          }}
          className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-400 transition-colors hover:border-neutral-300"
        >
          {placeholder}
          <Search className="size-3.5 text-neutral-400" />
        </button>

        {open && (
          <div className="absolute top-full right-0 left-0 z-50 mt-1.5 rounded-xl border border-neutral-200 bg-white shadow-xl shadow-black/5">
            <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
              <Search className="size-3.5 shrink-0 text-neutral-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher…"
                className="w-full bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
              />
            </div>
            <div className="max-h-56 overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <p className="px-2.5 py-2 text-xs text-neutral-400">{emptyLabel}</p>
              )}
              {filtered.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggle(option.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-neutral-800 transition-colors hover:bg-neutral-50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.sublabel && (
                      <span className="block truncate text-xs text-neutral-400">{option.sublabel}</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
