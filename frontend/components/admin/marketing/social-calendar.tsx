"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PLATFORM_META } from "@/components/admin/marketing/social-platform";
import type { SocialPost } from "@/lib/api/types";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTH_LABEL = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

function isoDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfCalendar(year: number, month: number) {
  const first = new Date(year, month, 1);
  // getDay(): 0=Sunday..6=Saturday — shift to a Monday-start offset.
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);
  return start;
}

export function SocialCalendar({
  posts,
  onSelectDay,
  onSelectPost,
}: {
  posts: SocialPost[];
  onSelectDay: (isoDate: string) => void;
  onSelectPost: (post: SocialPost) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const today = isoDay(new Date());

  const postsByDay = useMemo(() => {
    const map = new Map<string, SocialPost[]>();
    for (const post of posts) {
      if (!post.scheduled_at) continue;
      const key = isoDay(new Date(post.scheduled_at));
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const unscheduled = useMemo(() => posts.filter((p) => !p.scheduled_at), [posts]);

  const days = useMemo(() => {
    const start = startOfCalendar(cursor.getFullYear(), cursor.getMonth());
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return date;
    });
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
          const dayPosts = postsByDay.get(key) ?? [];
          const inMonth = date.getMonth() === cursor.getMonth();
          const visible = dayPosts.slice(0, 3);
          const overflow = dayPosts.length - visible.length;
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
                {visible.map((post) => {
                  const meta = PLATFORM_META[post.platform];
                  return (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => onSelectPost(post)}
                      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[0.7rem] text-white"
                      style={{ background: meta.bg }}
                      title={post.title}
                    >
                      <span className="truncate">{post.title || meta.label}</span>
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

      {unscheduled.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="mb-2 text-xs font-medium text-amber-800">
            {unscheduled.length} brouillon{unscheduled.length > 1 ? "s" : ""} sans date — pas encore sur le calendrier
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((post) => {
              const meta = PLATFORM_META[post.platform];
              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => onSelectPost(post)}
                  className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs text-neutral-700 hover:border-amber-300"
                >
                  <span className="size-1.5 rounded-full" style={{ background: meta.bg }} />
                  {post.title || meta.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
