"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { getDepartment, listEmployees } from "@/lib/api/hr";
import type { Department, EmployeeProfile, UserBrief } from "@/lib/api/types";
import { DepartmentFormModal } from "@/components/admin/rh/department-form-modal";
import { cn } from "@/lib/utils";

const DEFAULT_COLOR = "#22d3ee";

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

export function DepartmentDetail({ id }: { id: string }) {
  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserBrief | null>(null);

  async function load() {
    try {
      const [dept, employeesRes] = await Promise.all([getDepartment(id), listEmployees()]);
      setDepartment(dept);
      setEmployees(employeesRes.results);
    } catch {
      setError("Impossible de charger ce département (accès refusé ou introuvable).");
    }
  }

  useEffect(() => {
    load();
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!department) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const color = department.color ?? DEFAULT_COLOR;
  const members = department.members ?? [];
  const selectedEmployee = selected ? employees.find((e) => e.user.id === selected.id) : undefined;

  return (
    <div>
      <Link
        href="/admin/rh/departements"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="size-3.5" /> Départements
      </Link>

      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: color }} />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: color }}>
              <span className="text-sm font-bold">{department.name.slice(0, 2).toUpperCase()}</span>
            </span>
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">{department.name}</h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                {members.length} membre{members.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <DepartmentFormModal department={department} onSaved={load} trigger={
            <button type="button" className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 hover:border-primary/40 hover:text-primary">
              Modifier
            </button>
          } />
        </div>
        {department.description && (
          <p className="mt-4 max-w-2xl text-sm text-neutral-600">{department.description}</p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-neutral-900">Membres</h2>
          </div>
          <div className="divide-y divide-neutral-100">
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelected(m)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-neutral-50",
                  selected?.id === m.id && "bg-primary/5"
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local/optimizable asset
                    <img src={m.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    initials(m.first_name, m.last_name)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-neutral-900">
                    {m.first_name} {m.last_name}
                  </span>
                  <span className="block truncate text-xs text-neutral-400">{m.email}</span>
                </span>
              </button>
            ))}
            {members.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-neutral-400">Aucun membre dans ce département.</p>
            )}
          </div>
        </div>

        <div className="sticky top-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          {selected ? (
            <div>
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-lg font-semibold text-neutral-600">
                {selected.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local/optimizable asset
                  <img src={selected.avatar_url} alt="" className="size-full object-cover" />
                ) : (
                  initials(selected.first_name, selected.last_name)
                )}
              </span>
              <p className="mt-3 text-base font-semibold text-neutral-900">
                {selected.first_name} {selected.last_name}
              </p>
              {selectedEmployee?.position && (
                <p className="text-xs text-neutral-500">{selectedEmployee.position}</p>
              )}
              <p className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                <Mail className="size-3.5 shrink-0" /> {selected.email}
              </p>
              {selectedEmployee && (
                <Link
                  href={`/admin/rh/${selectedEmployee.id}`}
                  className="mt-4 block rounded-full bg-neutral-900 px-4 py-2 text-center text-xs font-semibold text-white hover:bg-neutral-700"
                >
                  Voir la fiche employé
                </Link>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-neutral-400">
              Sélectionne un membre pour voir ses informations.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
