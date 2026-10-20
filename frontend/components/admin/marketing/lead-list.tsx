"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadSlideOver } from "@/components/admin/marketing/lead-slide-over";
import { listLeads, createLead, updateLead, type LeadInput } from "@/lib/api/marketing";
import { listUsers } from "@/lib/api/hr";
import type { Lead, LeadStatus, LeadSource, UserBrief } from "@/lib/api/types";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOUVEAU: "Nouveau",
  QUALIFIE: "Qualifié",
  PROPOSITION_EN_COURS: "Proposition en cours",
  PERDU: "Perdu",
  CONVERTI: "Converti",
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  FORMULAIRE_CONTACT: "Formulaire de contact",
  FORMULAIRE_DEVIS: "Formulaire de devis",
  APPEL_ENTRANT: "Appel entrant",
  SITE_WEB: "Site web",
  EVENEMENT: "Événement",
};

// Display order for the board — funnel progression left to right, with the
// two terminal states (won/lost) at the end rather than LeadStatus's
// declaration order (which interleaves PERDU before CONVERTI).
const LANE_ORDER: LeadStatus[] = ["NOUVEAU", "QUALIFIE", "PROPOSITION_EN_COURS", "CONVERTI", "PERDU"];

const LANE_ACCENT: Record<LeadStatus, string> = {
  NOUVEAU: "border-t-primary",
  QUALIFIE: "border-t-emerald-500",
  PROPOSITION_EN_COURS: "border-t-amber-500",
  CONVERTI: "border-t-emerald-700",
  PERDU: "border-t-neutral-300",
};

const SCORE_COLOR = (score: number) =>
  score >= 70 ? "bg-emerald-100 text-emerald-700" : score >= 40 ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-500";

export function LeadList() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<LeadStatus | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);

  async function load() {
    try {
      // listUsers() is Super-Admin/RH/Responsable Marketing only (server
      // side) — a Commercial can view and work leads but can't reassign
      // them, so a 403 there is expected and must not block the leads
      // themselves from loading; it only means the assignee picker stays
      // empty for that role.
      const [leadsRes, usersRes] = await Promise.all([
        listLeads(),
        listUsers().catch(() => ({ results: [] as UserBrief[] })),
      ]);
      setLeads(leadsRes.results);
      setUsers(usersRes.results);
    } catch {
      setError("Impossible de charger les leads.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatusChange(lead: Lead, status: LeadStatus) {
    setSavingId(lead.id);
    try {
      const updated = await updateLead(lead.id, { status });
      setLeads((prev) => prev && prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch {
      setError(`Impossible de mettre à jour le statut de ${lead.first_name} ${lead.last_name}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleAssign(lead: Lead, userId: string) {
    setSavingId(lead.id);
    try {
      const updated = await updateLead(lead.id, { assigned_to_id: userId || null });
      setLeads((prev) => prev && prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch {
      setError(`Impossible de réassigner ${lead.first_name} ${lead.last_name}.`);
    } finally {
      setSavingId(null);
    }
  }

  function handleDrop(status: LeadStatus) {
    setDragOverLane(null);
    const lead = leads?.find((l) => l.id === draggedId);
    setDraggedId(null);
    if (lead && lead.status !== status) handleStatusChange(lead, status);
  }

  function handleCreated(lead: Lead) {
    setLeads((prev) => (prev ? [lead, ...prev] : prev));
    setCreateOpen(false);
  }

  function handleUpdated(lead: Lead) {
    setLeads((prev) => prev && prev.map((l) => (l.id === lead.id ? lead : l)));
    setEditLead(null);
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!leads) {
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
          <h1 className="text-2xl font-semibold text-neutral-900">Tunnel commercial</h1>
          <p className="text-sm text-neutral-500">
            Glissez une carte pour changer son statut, ou cliquez dessus pour voir le détail.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-full px-4 shadow-sm">
          <Plus className="size-4" /> Nouveau lead
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {LANE_ORDER.map((status, laneIndex) => {
          const laneLeads = leads.filter((lead) => lead.status === status);
          return (
            <div
              key={status}
              data-tour={laneIndex === 0 ? "module-marketing-leads" : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverLane(status);
              }}
              onDragLeave={() => setDragOverLane((current) => (current === status ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(status);
              }}
              className={cn(
                "flex min-w-0 flex-col rounded-xl border border-t-4 border-neutral-200 bg-neutral-50/60 transition-colors",
                LANE_ACCENT[status],
                dragOverLane === status && "bg-primary/5 ring-2 ring-primary/30"
              )}
            >
              <div className="flex items-start justify-between gap-1.5 px-2.5 py-2.5">
                <p className="text-xs leading-tight font-semibold text-neutral-900">{STATUS_LABELS[status]}</p>
                <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[0.65rem] font-medium text-neutral-500 shadow-sm">
                  {laneLeads.length}
                </span>
              </div>

              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2.5">
                {laneLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDraggedId(lead.id)}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => setEditLead(lead)}
                    className={cn(
                      "cursor-grab rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm transition-opacity active:cursor-grabbing",
                      draggedId === lead.id && "opacity-40",
                      savingId === lead.id && "pointer-events-none opacity-60"
                    )}
                  >
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="truncate text-xs text-neutral-400">{lead.company_name || lead.email}</p>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="truncate text-[0.65rem] text-neutral-400">{SOURCE_LABELS[lead.source]}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium ${SCORE_COLOR(lead.qualification_score)}`}>
                        {lead.qualification_score}
                      </span>
                    </div>

                    <select
                      value={lead.assigned_to?.id ?? ""}
                      onChange={(e) => handleAssign(lead, e.target.value)}
                      disabled={savingId === lead.id}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 w-full truncate rounded-md border-0 bg-neutral-50 py-1 text-[0.7rem] text-neutral-600 outline-none"
                    >
                      <option value="">— Non assigné —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                      ))}
                    </select>
                  </div>
                ))}

                {laneLeads.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-neutral-300">Aucun lead</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-over (tiroir coulissant de la droite vers la gauche) pour nouveau lead */}
      <LeadSlideOver
        open={createOpen}
        onOpenChange={setCreateOpen}
        lead={null}
        users={users}
        onSaved={handleCreated}
      />

      {/* Slide-over pour détail d'un lead (3 onglets) et modification */}
      <LeadSlideOver
        open={editLead !== null}
        onOpenChange={(open) => !open && setEditLead(null)}
        lead={editLead}
        users={users}
        onSaved={handleUpdated}
      />
    </div>
  );
}
