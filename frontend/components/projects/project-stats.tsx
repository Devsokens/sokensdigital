import type { ProjectStat } from "@/lib/projects/types";

export function ProjectStats({ stats }: { stats: ProjectStat[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-white/10 bg-card/60 p-6 text-center"
        >
          <p className="text-3xl font-bold text-primary">{stat.value}</p>
          <p className="mt-1 text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}
