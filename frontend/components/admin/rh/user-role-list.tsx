"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Check, ShieldCheck, Search } from "lucide-react";
import { listUsers, listDepartments, setUserRole } from "@/lib/api/hr";
import { listProfiles } from "@/lib/firebase/profile";
import type { Department, UserBrief } from "@/lib/api/types";
import type { Profile } from "@/lib/firebase/types";
import { ROLE_LABELS, type AppRole } from "@/lib/firebase/types";
import { inputClass } from "@/components/admin/form-styles";
import { AddEmployeeSheet } from "@/components/admin/rh/add-employee-sheet";

interface MergedUser {
  djangoId: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: AppRole | null;
  departmentId: string | null;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

export function UserRoleList() {
  const [rows, setRows] = useState<MergedUser[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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
          firstName: u.first_name,
          lastName: u.last_name,
          name: `${u.first_name} ${u.last_name}`.trim(),
          email: u.email,
          avatarUrl: profile?.avatarUrl ?? u.avatar_url ?? null,
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

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q));
  }, [rows, search]);

  const unprovisionedCount = rows?.filter((r) => !r.role).length ?? 0;

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
      <div className="mb-6 flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-neutral-900">Utilisateurs &amp; Rôles</h1>
          <p className="mt-1.5 max-w-xl text-sm text-neutral-500">
            Le rôle et le département déterminent ce que chaque personne peut voir et faire. Toute modification est
            enregistrée dans l&apos;Audit Log.
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
          <ShieldCheck className="size-3.5" /> Réservé au Super-Admin
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-neutral-100 px-5 py-3.5">
          <div className="flex max-w-[320px] flex-1 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2">
            <Search className="size-3.5 shrink-0 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un utilisateur"
              className="w-full min-w-0 border-0 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
            />
          </div>
          <span className="flex-1" />
          {unprovisionedCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="size-1.5 rounded-full bg-destructive" />
              {unprovisionedCount} compte{unprovisionedCount !== 1 ? "s" : ""} non provisionné{unprovisionedCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            <tr>
              <th className="px-5 py-3">Utilisateur</th>
              <th className="px-5 py-3">Rôle</th>
              <th className="px-5 py-3">Département</th>
              <th className="w-9 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((row, index) => (
              <tr key={row.djangoId} data-tour={index === 0 ? "module-rh-utilisateurs" : undefined}>
                <td className="px-5 py-3.5">
                  <span className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-600">
                      {row.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary URL, not a local/optimizable asset
                        <img src={row.avatarUrl} alt="" className="size-full object-cover" />
                      ) : (
                        initials(row.name || row.email)
                      )}
                    </span>
                    <span>
                      <span className="block font-medium text-neutral-900">{row.name || "—"}</span>
                      <span className="block text-xs text-neutral-400">{row.email}</span>
                    </span>
                  </span>
                </td>
                {row.role ? (
                  <>
                    <td className="px-5 py-3.5">
                      <select
                        value={row.role}
                        onChange={(e) => handleRoleChange(row, e.target.value as AppRole)}
                        disabled={savingId === row.djangoId}
                        className={`${inputClass} rounded-full py-1.5 text-xs font-semibold`}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={row.departmentId ?? ""}
                        onChange={(e) => handleDepartmentChange(row, e.target.value)}
                        disabled={savingId === row.djangoId}
                        className={`${inputClass} rounded-full py-1.5 text-xs`}
                      >
                        <option value="">— Aucun —</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                  </>
                ) : (
                  <td className="px-5 py-3.5" colSpan={2}>
                    <span className="flex items-center gap-3 rounded-lg border border-dashed border-neutral-200 px-3.5 py-2">
                      <span className="flex-1 text-xs text-neutral-500">Pas encore provisionné dans Firestore</span>
                      <AddEmployeeSheet
                        onCreated={load}
                        initialIdentity={{ firstName: row.firstName, lastName: row.lastName, email: row.email }}
                        trigger={
                          <button
                            type="button"
                            className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-700"
                          >
                            Provisionner
                          </button>
                        }
                      />
                    </span>
                  </td>
                )}
                <td className="px-5 py-3.5">
                  {savingId === row.djangoId && <Loader2 className="size-4 animate-spin text-neutral-400" />}
                  {savedId === row.djangoId && savingId !== row.djangoId && (
                    <Check className="size-4 text-primary" />
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  {rows.length === 0 ? "Aucun utilisateur pour l'instant." : "Aucun résultat."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
