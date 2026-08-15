"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listDepartments, createDepartment } from "@/lib/api/hr";
import type { Department } from "@/lib/api/types";
import { inputClass, labelClass, cardClass } from "@/components/admin/form-styles";

const DEFAULT_COLOR = "#22d3ee";

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

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
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Départements</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            La couleur d&apos;un département sert de repère dans les salons, les projets et les timesheets.
          </p>
        </div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((d) => {
          const color = d.color ?? DEFAULT_COLOR;
          // member_count/members are absent from older API responses (e.g.
          // a not-yet-redeployed backend) — degrade gracefully to "no
          // preview" instead of crashing the whole list.
          const members = d.members ?? [];
          const memberCount = d.member_count ?? members.length;
          const overflow = memberCount - members.length;
          return (
            <div key={d.id} className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{d.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {memberCount} membre{memberCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="size-6 shrink-0 rounded-lg" style={{ backgroundColor: color }} />
              </div>
              {members.length > 0 && (
                <div className="mt-4 flex">
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
          );
        })}

        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex min-h-[150px] flex-col items-center justify-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-neutral-200 text-neutral-400 transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus className="size-5" />
          <span className="text-sm font-semibold">Créer un département</span>
        </button>

        {departments.length === 0 && (
          <p className="text-sm text-neutral-400">Aucun département pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
