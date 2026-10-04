"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export function isoDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfCalendar(year: number, month: number) {
  const first = new Date(year, month, 1);
  // getDay(): 0=dimanche..6=samedi — décalé pour commencer le lundi.
  const offset = (first.getDay() + 6) % 7;
  return new Date(year, month, 1 - offset);
}

/** Calendrier mensuel générique (Plan éditorial, Agenda) : une grille de 6
 * semaines, jusqu'à 3 éléments par jour puis « +N autres ». Cliquer un
 * numéro de jour appelle `onSelectDay`, cliquer un élément `onSelectItem`. */
export function MonthCalendar<T>({
  items,
  getDate,
  getKey,
  getLabel,
  getColor,
  getPrefix,
  onSelectDay,
  onSelectItem,
}: {
  items: T[];
  /** Date-heure ISO de l'élément, ou null s'il n'est pas planifié. */
  getDate: (item: T) => string | null;
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  /** Couleur de fond (hex) de l'étiquette. */
  getColor: (item: T) => string;
  /** Texte court avant le libellé (ex. l'heure). */
  getPrefix?: (item: T) => string;
  onSelectDay: (isoDate: string) => void;
  onSelectItem: (item: T) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const [today] = useState(() => isoDay(new Date()));

  const itemsByDay = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const date = getDate(item);
      if (!date) continue;
      const key = isoDay(new Date(date));
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (getDate(a) ?? "").localeCompare(getDate(b) ?? ""));
    }
    return map;
    // Les accesseurs sont des fonctions fléchées recréées à chaque rendu
    // du parent : seule la liste compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const days = useMemo(() => {
    const start = startOfCalendar(cursor.getFullYear(), cursor.getMonth());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cursor]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900 capitalize">{MONTH_LABEL.format(cursor)}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="rounded-full px-3 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            aria-label="Mois précédent"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Mois suivant"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-neutral-200">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="border-b border-neutral-200 bg-neutral-50 px-2 py-1.5 text-center text-xs font-medium text-neutral-500">
            {label}
          </div>
        ))}
        {days.map((date) => {
          const key = isoDay(date);
          const dayItems = itemsByDay.get(key) ?? [];
          const inMonth = date.getMonth() === cursor.getMonth();
          const visible = dayItems.slice(0, 3);
          const overflow = dayItems.length - visible.length;
          return (
            <div
              key={key}
              className={`min-h-24 border-r border-b border-neutral-100 p-1.5 last:border-r-0 ${inMonth ? "bg-white" : "bg-neutral-50/50"}`}
            >
              <button
                type="button"
                onClick={() => onSelectDay(key)}
                className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs ${
                  key === today
                    ? "bg-primary font-semibold text-primary-foreground"
                    : inMonth
                      ? "text-neutral-700 hover:bg-neutral-100"
                      : "text-neutral-300 hover:bg-neutral-100"
                }`}
              >
                {date.getDate()}
              </button>
              <div className="space-y-1">
                {visible.map((item) => {
                  const prefix = getPrefix?.(item);
                  return (
                    <button
                      key={getKey(item)}
                      type="button"
                      onClick={() => onSelectItem(item)}
                      // Blanc en dur (pas text-white) : le thème sombre de
                      // l'admin inverse --color-white, ce qui rendrait le
                      // texte sombre sur ces fonds colorés.
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[0.7rem]"
                      style={{ background: getColor(item), color: "#ffffff" }}
                      title={getLabel(item)}
                    >
                      {prefix && <span className="shrink-0 font-semibold opacity-90">{prefix}</span>}
                      <span className="truncate">{getLabel(item)}</span>
                    </button>
                  );
                })}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(key)}
                    className="px-1 text-[0.7rem] text-neutral-400 hover:text-neutral-600"
                  >
                    +{overflow} autre{overflow > 1 ? "s" : ""}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
