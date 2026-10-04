"use client";

import { useMemo } from "react";
import { MonthCalendar } from "@/components/admin/month-calendar";
import { PLATFORM_META } from "@/components/admin/marketing/social-platform";
import type { SocialPost } from "@/lib/api/types";

/** Plan éditorial : le calendrier mensuel commun (MonthCalendar), plus les
 * brouillons sans date en dessous. */
export function SocialCalendar({
  posts,
  onSelectDay,
  onSelectPost,
}: {
  posts: SocialPost[];
  onSelectDay: (isoDate: string) => void;
  onSelectPost: (post: SocialPost) => void;
}) {
  const unscheduled = useMemo(() => posts.filter((p) => !p.scheduled_at), [posts]);

  return (
    <div>
      <MonthCalendar
        items={posts}
        getDate={(post) => post.scheduled_at}
        getKey={(post) => post.id}
        getLabel={(post) => post.title || PLATFORM_META[post.platform].label}
        getColor={(post) => PLATFORM_META[post.platform].bg}
        onSelectDay={onSelectDay}
        onSelectItem={onSelectPost}
      />

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
