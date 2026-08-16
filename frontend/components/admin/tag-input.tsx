"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { inputClass } from "@/components/admin/form-styles";
import { cn } from "@/lib/utils";

/** Type-and-press-Enter chip input — Enter or comma commits the current
 * text as a new tag, Backspace on an empty field removes the last one.
 * Deliberately not a full combobox/autocomplete: tags here are freeform
 * labels (see SocialPost.tags), not a fixed vocabulary. */
export function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) return;
    onChange([...value, tag]);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      setDraft("");
    } else if (event.key === "Backspace" && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function handleBlur() {
    if (draft.trim()) {
      commit(draft);
      setDraft("");
    }
  }

  return (
    <div className={cn(inputClass, "flex flex-wrap items-center gap-1.5 py-2")}>
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            aria-label={`Retirer le tag ${tag}`}
            className="text-primary/60 hover:text-primary"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : undefined}
        className="min-w-24 flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 outline-none"
      />
    </div>
  );
}
