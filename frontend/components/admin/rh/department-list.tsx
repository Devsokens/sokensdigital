"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MoreHorizontal } from "lucide-react";
import { listDepartments, deleteDepartment } from "@/lib/api/hr";
import type { Department } from "@/lib/api/types";
import { DepartmentFormModal } from "@/components/admin/rh/department-form-modal";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const DEFAULT_COLOR = "#22d3ee";

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

export function DepartmentList() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await listDepartments();
      setDepartments(data.results);
    } catch {
      setError("Impossible de charger les départements.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!departments) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Départements</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            La couleur d&apos;un département sert de repère dans les salons, les projets et les timesheets.
          </p>
        </div>
        <DepartmentFormModal onSaved={load} />
      </div>

      <div className="grid grid-cols-1 auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => {
          const color = d.color ?? DEFAULT_COLOR;
          // member_count/members are absent from older API responses (e.g.
          // a not-yet-redeployed backend) — degrade gracefully to "no
          // preview" instead of crashing the whole list.
          const members = d.members ?? [];
          const memberCount = d.member_count ?? members.length;
          const overflow = memberCount - members.length;
          return (
            <Link
              key={d.id}
              href={`/admin/rh/departements/${d.id}`}
              className="relative flex min-h-[168px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{d.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {memberCount} membre{memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="size-6 rounded-lg" style={{ backgroundColor: color }} />
                  <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                    <Popover>
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            aria-label="Actions du département"
                            className="flex size-6 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </button>
                        }
                      />
                      <PopoverContent className="w-40 p-1" align="end">
                        <DepartmentFormModal
                          department={d}
                          onSaved={load}
                          trigger={
                            <button
                              type="button"
                              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                            >
                              Modifier
                            </button>
                          }
                        />
                        <ConfirmModal
                          title="Supprimer le département"
                          description={`Supprimer définitivement « ${d.name} » ? Cette action est irréversible.`}
                          disabled={memberCount > 0}
                          disabledReason={`Ce département compte ${memberCount} employé${memberCount !== 1 ? "s" : ""} — retire-les d'abord avant de le supprimer.`}
                          onConfirm={async () => { await deleteDepartment(d.id); load(); }}
                          trigger={
                            <button
                              type="button"
                              className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-destructive hover:bg-destructive/5"
                            >
                              Supprimer
                            </button>
                          }
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
              {d.description && (
                <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{d.description}</p>
              )}
              <div className="mt-auto pt-4">
                {members.length > 0 && (
                  <div className="flex">
                    {members.map((m) => (
                      <span
                        key={m.id}
                        title={`${m.first_name} ${m.last_name}`}
                        className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-neutral-100 text-[10.5px] font-semibold text-neutral-600 -ml-2 first:ml-0"
                      >
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local/optimizable asset
                          <img src={m.avatar_url} alt="" className="size-full object-cover" />
                        ) : (
                          initials(m.first_name, m.last_name)
                        )}
                      </span>
                    ))}
                    {overflow > 0 && (
                      <span className="-ml-2 flex size-7 items-center justify-center rounded-full border-2 border-white bg-neutral-50 text-[10.5px] font-semibold text-neutral-400">
                        +{overflow}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}

        {departments.length === 0 && (
          <p className="text-sm text-neutral-400">Aucun département pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
