"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import type { EmployeeProfile } from "@/lib/api/types";

const NO_DEPARTMENT_LABEL = "Sans département";

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

/** Grouped-by-department view — there's no manager/reporting-line field
 * in the data model, so a real hierarchical org chart isn't derivable
 * from what's stored. This is the honest reading of "organigramme" given
 * that: each department is a branch, its employees hang under it. */
export function EmployeeOrgChart({ employees }: { employees: EmployeeProfile[] }) {
  const byDepartment = useMemo(() => {
    const groups = new Map<string, EmployeeProfile[]>();
    for (const e of employees) {
      const key = e.user.department_name || NO_DEPARTMENT_LABEL;
      const list = groups.get(key) ?? [];
      list.push(e);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === NO_DEPARTMENT_LABEL) return 1;
      if (b === NO_DEPARTMENT_LABEL) return -1;
      return a.localeCompare(b);
    });
  }, [employees]);

  if (employees.length === 0) {
    return <p className="py-16 text-center text-sm text-neutral-400">Aucun employé pour l&apos;instant.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {byDepartment.map(([department, members]) => (
        <div key={department} className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-neutral-100 px-5 py-3.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-3.5" />
            </span>
            <span className="text-sm font-semibold text-neutral-900">{department}</span>
            <span className="ml-auto text-xs text-neutral-400">{members.length}</span>
          </div>
          <div className="space-y-1 p-3">
            {members.map((m) => (
              <Link
                key={m.id}
                href={`/admin/rh/${m.id}`}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-neutral-50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                  {m.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local/optimizable asset
                    <img src={m.user.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    initials(m.user.first_name, m.user.last_name)
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-neutral-900">
                    {m.user.first_name} {m.user.last_name}
                  </span>
                  <span className="block truncate text-xs text-neutral-400">{m.position || "—"}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
