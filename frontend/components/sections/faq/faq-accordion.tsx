"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicFAQEntry } from "@/lib/api/public";

export function FAQAccordion({ entries }: { entries: PublicFAQEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(entries[0]?.id ?? null);

  const groups = entries.reduce<Record<string, PublicFAQEntry[]>>((acc, entry) => {
    const key = entry.category || "Général";
    (acc[key] ??= []).push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      {Object.entries(groups).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{category}</h2>
          <div className="mt-4 space-y-3">
            {items.map((entry) => {
              const isOpen = openId === entry.id;
              return (
                <div key={entry.id} className="overflow-hidden rounded-xl border border-white/10 bg-card/60">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : entry.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-medium text-foreground">{entry.question}</span>
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{entry.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
