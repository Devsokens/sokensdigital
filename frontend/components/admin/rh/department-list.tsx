"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDepartments, createDepartment } from "@/lib/api/hr";
import type { Department } from "@/lib/api/types";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/50 focus:outline-none";

export function DepartmentList() {
  const [departments, setDepartments] = useState<Department[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createDepartment({ name });
      setName("");
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!departments) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Départements</h1>
        <Button onClick={() => setShowForm((v) => !v)} className="gap-1.5 rounded-full px-4">
          <Plus className="size-4" /> Nouveau département
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 flex items-end gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs text-muted-foreground">Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </label>
          <Button type="submit" disabled={saving} className="rounded-full px-5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Créer"}
          </Button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: d.color ?? "#22d3ee" }}
              />
              <span className="text-sm font-medium text-foreground">{d.name}</span>
            </div>
          </div>
        ))}
        {departments.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun département pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
