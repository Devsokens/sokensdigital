"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { listProjects, createProject } from "@/lib/api/projects";
import type { Project, ProjectStatus } from "@/lib/api/types";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  EN_COURS: "En cours",
  EN_PAUSE: "En pause",
  TERMINE: "Terminé",
  ANNULE: "Annulé",
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  EN_COURS: "bg-primary/10 text-primary",
  EN_PAUSE: "bg-amber-100 text-amber-700",
  TERMINE: "bg-emerald-100 text-emerald-700",
  ANNULE: "bg-neutral-100 text-neutral-500",
};

export function ProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    try {
      const data = await listProjects();
      setProjects(data.results);
    } catch {
      setError("Impossible de charger les projets.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!projects) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Gestion de projet</h1>
          <p className="text-sm text-neutral-500">Projets que tu diriges ou dont tu es membre.</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Nouveau projet
              </Button>
            }
          />
          <SheetContent title="Nouveau projet">
            <NewProjectForm onSaved={() => { setOpen(false); load(); }} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/admin/technique/projets/${project.id}`}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/40"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[project.status]}`}>
                {STATUS_LABELS[project.status]}
              </span>
            </div>
            <h2 className="text-sm font-medium text-neutral-900">{project.name}</h2>
            <p className="mt-1 text-xs text-neutral-400">
              {project.members.length} membre{project.members.length !== 1 ? "s" : ""}
              {project.lead_project_manager && ` — dirigé par ${project.lead_project_manager.first_name} ${project.lead_project_manager.last_name}`}
            </p>
          </Link>
        ))}
        {projects.length === 0 && (
          <p className="text-sm text-neutral-400">Aucun projet pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}

function NewProjectForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createProject({
        name,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        budget: budget || undefined,
      });
      onSaved();
    } catch {
      setError("Impossible de créer le projet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}
      <label className="block">
        <span className={labelClass}>Nom</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Date de début</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Date de fin</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Budget</span>
        <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} className={inputClass} />
      </label>
      <p className="text-xs text-neutral-400">Tu deviens automatiquement le chef de ce projet.</p>
      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Créer"}
        </Button>
      </div>
    </form>
  );
}
