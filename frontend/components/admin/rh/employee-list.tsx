"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { listEmployees } from "@/lib/api/hr";
import type { EmployeeProfile } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { AddEmployeeSheet } from "@/components/admin/rh/add-employee-sheet";

export function EmployeeList() {
  const [employees, setEmployees] = useState<EmployeeProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await listEmployees();
      setEmployees(data.results);
    } catch (err) {
      setError(err instanceof ApiError ? `Erreur ${err.status}` : "Erreur de chargement");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!employees) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Employés</h1>
        <AddEmployeeSheet onCreated={load} />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Poste</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Embauche</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {employees.map((e) => (
              <tr key={e.id} className="transition-colors hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/admin/rh/${e.id}`} className="text-neutral-900 hover:text-primary">
                    {e.user.first_name} {e.user.last_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-500">{e.position || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      e.status === "ACTIF"
                        ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        : "rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500"
                    }
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">{e.hire_date || "—"}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  Aucun employé pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
