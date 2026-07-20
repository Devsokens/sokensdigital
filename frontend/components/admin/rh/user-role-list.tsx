"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { listUsers, listDepartments, setUserRole } from "@/lib/api/hr";
import { listProfiles } from "@/lib/firebase/profile";
import type { Department, UserBrief } from "@/lib/api/types";
import type { Profile } from "@/lib/firebase/types";
import { ROLE_LABELS, type AppRole } from "@/lib/firebase/types";
import { inputClass } from "@/components/admin/form-styles";

interface MergedUser {
  djangoId: string;
  name: string;
  email: string;
  role: AppRole | null;
  departmentId: string | null;
}

export function UserRoleList() {
  const [rows, setRows] = useState<MergedUser[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function load() {
    try {
      const [usersRes, profiles, deptRes] = await Promise.all([
        listUsers(),
        listProfiles(),
        listDepartments(),
      ]);
      setDepartments(deptRes.results);

      const profileByEmail = new Map<string, Profile>(
        profiles.map((p) => [p.email.toLowerCase(), p])
      );
      const merged = usersRes.results.map((u: UserBrief) => {
        const profile = profileByEmail.get(u.email.toLowerCase());
        return {
          djangoId: u.id,
          name: `${u.first_name} ${u.last_name}`.trim(),
          email: u.email,
          role: profile?.role ?? null,
          departmentId: profile?.departmentId ?? null,
        };
      });
      setRows(merged);
    } catch {
      setError("Impossible de charger les utilisateurs.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRoleChange(row: MergedUser, role: AppRole) {
    setSavingId(row.djangoId);
    setSavedId(null);
    try {
      await setUserRole(row.djangoId, { role, department_id: row.departmentId ?? undefined });
      setRows((prev) => prev && prev.map((r) => (r.djangoId === row.djangoId ? { ...r, role } : r)));
      setSavedId(row.djangoId);
    } catch {
      setError(`Impossible de changer le rôle de ${row.name}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDepartmentChange(row: MergedUser, departmentId: string) {
    if (!row.role) return;
    setSavingId(row.djangoId);
    setSavedId(null);
    try {
      await setUserRole(row.djangoId, { role: row.role, department_id: departmentId || undefined });
      setRows((prev) => prev && prev.map((r) => (r.djangoId === row.djangoId ? { ...r, departmentId } : r)));
      setSavedId(row.djangoId);
    } catch {
      setError(`Impossible de changer le département de ${row.name}.`);
    } finally {
      setSavingId(null);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!rows) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Utilisateurs & Rôles</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Réservé au Super-Admin — le rôle et le département déterminent ce que chaque personne peut voir et faire.
      </p>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Département</th>
              <th className="w-8 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <tr key={row.djangoId}>
                <td className="px-4 py-3 text-neutral-900">{row.name || "—"}</td>
                <td className="px-4 py-3 text-neutral-500">{row.email}</td>
                <td className="px-4 py-3">
                  {row.role ? (
                    <select
                      value={row.role}
                      onChange={(e) => handleRoleChange(row, e.target.value as AppRole)}
                      disabled={savingId === row.djangoId}
                      className={`${inputClass} py-1.5`}
                    >
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs text-neutral-400">Pas encore provisionné (Firestore)</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={row.departmentId ?? ""}
                    onChange={(e) => handleDepartmentChange(row, e.target.value)}
                    disabled={savingId === row.djangoId || !row.role}
                    className={`${inputClass} py-1.5`}
                  >
                    <option value="">— Aucun —</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {savingId === row.djangoId && <Loader2 className="size-4 animate-spin text-neutral-400" />}
                  {savedId === row.djangoId && savingId !== row.djangoId && (
                    <Check className="size-4 text-primary" />
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  Aucun utilisateur pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
