"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listEmployees, listUsers, createEmployee } from "@/lib/api/hr";
import type { EmployeeProfile, UserBrief } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/50 focus:outline-none";

export function EmployeeList() {
  const [employees, setEmployees] = useState<EmployeeProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

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
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Employés</h1>
        <Button onClick={() => setShowForm((v) => !v)} className="gap-1.5 rounded-full px-4">
          <Plus className="size-4" /> Nouvel employé
        </Button>
      </div>

      {showForm && <NewEmployeeForm onCreated={() => { setShowForm(false); load(); }} />}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Poste</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Embauche</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {employees.map((e) => (
              <tr key={e.id} className="transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/admin/rh/${e.id}`} className="text-foreground hover:text-primary">
                    {e.user.first_name} {e.user.last_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.position || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      e.status === "ACTIF"
                        ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                        : "rounded-full bg-white/5 px-2 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {e.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{e.hire_date || "—"}</td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
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

function NewEmployeeForm({ onCreated }: { onCreated: () => void }) {
  const [users, setUsers] = useState<UserBrief[] | null>(null);
  const [userId, setUserId] = useState("");
  const [position, setPosition] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listUsers().then((data) => setUsers(data.results)).catch(() => setUsers([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!userId) {
      setError("Sélectionne un utilisateur.");
      return;
    }
    setSaving(true);
    try {
      await createEmployee({ user_id: userId, position, hire_date: hireDate || undefined });
      onCreated();
    } catch {
      setError("Impossible de créer le profil employé.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Utilisateur</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass} required>
            <option value="">— Choisir —</option>
            {users?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name} ({u.email})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Poste</span>
          <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Date d&apos;embauche</span>
          <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputClass} />
        </label>
      </div>
      <Button type="submit" disabled={saving} className="rounded-full px-5">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Créer"}
      </Button>
    </form>
  );
}
