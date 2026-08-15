"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDepartments, createDepartment } from "@/lib/api/hr";
import type { Department } from "@/lib/api/types";
import { inputClass, labelClass, cardClass } from "@/components/admin/form-styles";

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
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Départements</h1>
        <Button
          data-tour="module-rh-departements"
          onClick={() => setShowForm((v) => !v)}
          className="gap-1.5 rounded-full px-4"
        >
          <Plus className="size-4" /> Nouveau département
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className={`mb-6 flex items-end gap-3 ${cardClass}`}>
          <label className="block flex-1">
            <span className={labelClass}>Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </label>
          <Button type="submit" disabled={saving} className="rounded-full px-5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Créer"}
          </Button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => (
          <div key={d.id} className={cardClass}>
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: d.color ?? "#22d3ee" }}
              />
              <span className="text-sm font-medium text-neutral-900">{d.name}</span>
            </div>
          </div>
        ))}
        {departments.length === 0 && (
          <p className="text-sm text-neutral-400">Aucun département pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
