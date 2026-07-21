"use client";

import { useMemo, useState } from "react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import dynamicIconImports from "lucide-react/dynamicIconImports";
import { Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectionIcon, normalizeIconName } from "@/components/dynamic-icon";

export { SectionIcon, normalizeIconName };

const ALL_ICON_NAMES = Object.keys(dynamicIconImports) as IconName[];

export function IconPicker({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = q ? ALL_ICON_NAMES.filter((n) => n.includes(q)) : ALL_ICON_NAMES;
    return names.slice(0, 90);
  }, [query]);

  const normalizedValue = normalizeIconName(value || "layout-grid");

  return (
    <Popover>
      <PopoverTrigger className="flex items-center gap-2 rounded-md bg-white/[0.06] px-2 py-1 text-xs text-muted-foreground ring-1 ring-white/10 transition-colors hover:bg-white/10">
        <SectionIcon name={normalizedValue} className="size-3.5" />
        {normalizedValue}
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2.5">
          <Search className="size-3.5 shrink-0 text-neutral-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une icône…"
            className="w-full bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 outline-none"
          />
        </div>
        <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto p-2">
          {results.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onChange(name)}
              title={name}
              className="flex size-9 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-primary aria-selected:bg-primary/10 aria-selected:text-primary"
              aria-selected={name === normalizedValue}
            >
              <DynamicIcon name={name} className="size-4" />
            </button>
          ))}
          {results.length === 0 && (
            <p className="col-span-6 py-4 text-center text-xs text-neutral-400">Aucune icône trouvée.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
