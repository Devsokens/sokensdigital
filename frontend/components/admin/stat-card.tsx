/** Shared KPI tile — previously duplicated identically between the
 * Marketing and RH dashboards (components/admin/marketing/dashboard.tsx,
 * components/admin/rh/rh-dashboard.tsx). Also used by the global
 * cross-department dashboard (app/admin/page.tsx). */
export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="absolute -top-8 -right-8 size-24 rounded-full opacity-[0.08]" style={{ background: accent }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-neutral-900">{value}</p>
          {sublabel && <p className="mt-1 text-[0.7rem] text-neutral-400">{sublabel}</p>}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}1a`, color: accent }}>
          <Icon className="size-4.5" />
        </span>
      </div>
    </div>
  );
}
