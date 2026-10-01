"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CalendarDays, Loader2, Plus, Shield, Trash2, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { getProject, addProjectMember, removeProjectMember } from "@/lib/api/projects";
import { listUsers } from "@/lib/api/hr";
import { ProjectTaskBoard } from "@/components/admin/technique/project-task-board";
import { ProjectStatsTab } from "@/components/admin/technique/project-stats-tab";
import { ProjectOrganisationTab } from "@/components/admin/technique/project-organisation-tab";
import { AmbientVideoBackground } from "@/components/admin/technique/ambient-video-background";
import { formatFcfa } from "@/lib/format-currency";
import type { Project, ProjectPriority, ProjectStatus, UserBrief } from "@/lib/api/types";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  EN_COURS: "En cours",
  EN_PAUSE: "En pause",
  TERMINE: "Terminé",
  ANNULE: "Annulé",
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  EN_COURS: "bg-indigo-100 text-indigo-700",
  EN_PAUSE: "bg-neutral-100 text-neutral-500",
  TERMINE: "bg-emerald-100 text-emerald-700",
  ANNULE: "bg-rose-100 text-rose-600",
};

const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  BASSE: "Basse",
  MOYENNE: "Moyenne",
  HAUTE: "Haute",
};

const PRIORITY_COLORS: Record<ProjectPriority, string> = {
  BASSE: "bg-sky-100 text-sky-700",
  MOYENNE: "bg-violet-100 text-violet-700",
  HAUTE: "bg-orange-100 text-orange-700",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

export function ProjectDetail({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [memberPopoverOpen, setMemberPopoverOpen] = useState(false);

  async function load() {
    try {
      setProject(await getProject(id));
    } catch {
      setError("Impossible de charger ce projet (accès refusé ou introuvable).");
    }
  }

  useEffect(() => {
    load();
    listUsers().then((data) => setUsers(data.results)).catch(() => setUsers([]));
  }, [id]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId || !project) return;
    setMemberBusy(true);
    try {
      await addProjectMember(project.id, selectedUserId);
      setSelectedUserId("");
      setMemberPopoverOpen(false);
      load();
    } catch {
      alert("Impossible d'ajouter ce membre.");
    } finally {
      setMemberBusy(false);
    }
  }

  async function handleRemoveMember(membershipId: string) {
    if (!project) return;
    setMemberBusy(true);
    try {
      await removeProjectMember(project.id, membershipId);
      load();
    } catch {
      alert("Impossible de retirer ce membre.");
    } finally {
      setMemberBusy(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/technique/projets"
          className="inline-flex items-center gap-2 text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-4" /> Retour aux projets
        </Link>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const availableUsers = users.filter((u) => !project.members.some((m) => m.user.id === u.id));

  return (
    // Même vidéo d'ambiance que la liste des projets (project-list.tsx),
    // demandée aussi ici — même structure (marges négatives pour aller
    // jusqu'aux bords du layout admin).
    <div className="relative isolate -mx-6 -mt-8 min-h-[calc(100dvh-4rem)] space-y-6 px-6 pt-8 lg:-mx-10 lg:px-10">
      <AmbientVideoBackground />
      {/* Top navigation & Project Header */}
      <div>
        <Link
          href="/admin/technique/projets"
          className="group mb-3 inline-flex items-center gap-2 text-sm font-medium text-neutral-700 transition-colors hover:text-neutral-900"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Retour aux projets</span>
        </Link>

        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          {/* Image de couverture : posée mais jamais affichée nulle part
           * jusqu'ici, uniquement stockée. */}
          {project.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.cover_image_url}
              alt=""
              className="h-40 w-full object-cover sm:h-52"
            />
          )}
          <div className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-neutral-900">{project.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[project.status]}`}>
                {STATUS_LABELS[project.status]}
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[project.priority]}`}>
                Priorité {PRIORITY_LABELS[project.priority]}
              </span>
              {project.category && (
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-700">
                  {project.category}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-800">
              <span className="flex items-center gap-1.5">
                <Shield className="size-3.5 text-neutral-400" />
                Dirigé par{" "}
                <strong className="font-semibold text-neutral-700">
                  {project.lead_project_manager
                    ? `${project.lead_project_manager.first_name} ${project.lead_project_manager.last_name}`
                    : "Non assigné"}
                </strong>
              </span>
              {project.client && (
                <Link
                  href={`/admin/rh/clients/${project.client.id}`}
                  className="flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Building2 className="size-3.5" />
                  {project.client.company_name}
                </Link>
              )}
              {(project.start_date || project.end_date) && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-neutral-400" />
                  {formatDate(project.start_date)} → {formatDate(project.end_date)}
                </span>
              )}
              {project.budget && (
                <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <Wallet className="size-3.5 text-emerald-600" />
                  Budget : {formatFcfa(project.budget)}
                </span>
              )}
            </div>
          </div>

          {/* Members management popover */}
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <div className="flex -space-x-2">
                {project.members.slice(0, 4).map((member) => (
                  <span
                    key={member.id}
                    title={`${member.user.first_name} ${member.user.last_name}`}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary/10 text-[11px] font-semibold text-primary"
                  >
                    {initials(member.user.first_name, member.user.last_name)}
                  </span>
                ))}
                {project.members.length > 4 && (
                  <span className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-[11px] font-semibold text-neutral-600">
                    +{project.members.length - 4}
                  </span>
                )}
              </div>
            </div>

            <Popover open={memberPopoverOpen} onOpenChange={setMemberPopoverOpen}>
              <PopoverTrigger
                render={
                  // Même correction que le bouton Filtre de project-list.tsx :
                  // variant="outline" hérite des tokens du thème sombre, invisible
                  // sur le fond clair de l'admin.
                  <Button size="sm" className="gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-700 hover:bg-neutral-50">
                    <Users className="size-3.5" /> Équipe ({project.members.length})
                  </Button>
                }
              />
              <PopoverContent className="w-80 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-800">Membres du projet</p>
                <div className="mb-3 max-h-48 space-y-1.5 overflow-y-auto">
                  {project.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs">
                      <span className="font-medium text-neutral-800">{m.user.first_name} {m.user.last_name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={memberBusy}
                        className="text-neutral-400 hover:text-destructive"
                        title="Retirer"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {project.members.length === 0 && (
                    <p className="text-xs text-neutral-400">Aucun membre pour le moment.</p>
                  )}
                </div>

                <form onSubmit={handleAddMember} className="space-y-2 border-t border-neutral-100 pt-3">
                  <label className="block">
                    <span className={labelClass}>Ajouter un membre</span>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">— Sélectionner —</option>
                      {availableUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" size="sm" disabled={memberBusy || !selectedUserId} className="w-full gap-1 rounded-full">
                    <Plus className="size-3.5" /> Ajouter
                  </Button>
                </form>
              </PopoverContent>
            </Popover>
          </div>
          </div>

          {/* Description : posée dans le formulaire (éditeur riche) mais
           * jamais affichée nulle part jusqu'ici non plus. */}
          {project.description && (
            <div
              className="prose-sm max-w-none border-t border-neutral-100 px-5 py-4 text-sm text-neutral-800 [&_a]:text-primary [&_a]:underline [&_h2]:mt-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: project.description }}
            />
          )}
        </div>
      </div>

      {/* Onglets Tâches / Statistiques — la page n'en avait aucun avant,
       * le tableau des tâches s'affichait directement. */}
      <Tabs defaultValue="taches">
        <TabsList>
          <TabsTab value="taches">Tâches</TabsTab>
          <TabsTab value="organisation">Organisation</TabsTab>
          <TabsTab value="stats">Statistiques</TabsTab>
          <TabsIndicator />
        </TabsList>
        <TabsPanel value="taches" className="pt-5">
          <ProjectTaskBoard project={project} />
        </TabsPanel>
        <TabsPanel value="organisation" className="pt-5">
          <ProjectOrganisationTab projectId={project.id} />
        </TabsPanel>
        <TabsPanel value="stats" className="pt-5">
          <ProjectStatsTab projectId={project.id} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
