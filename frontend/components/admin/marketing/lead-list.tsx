"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Building2,
  Eye,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSubmenu,
} from "@/components/admin/context-menu";
import { LeadSlideOver } from "@/components/admin/marketing/lead-slide-over";
import { listLeads, updateLead, deleteLead } from "@/lib/api/marketing";
import { listUsers } from "@/lib/api/hr";
import { usePermissions } from "@/lib/admin/permissions-context";
import type { Lead, LeadStatus, LeadSource, UserBrief } from "@/lib/api/types";
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
  CREATION_CLIENT: "Client créé directement",
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

/** Nom mis en avant sur la carte : l'entreprise, et à défaut (particulier)
 * le demandeur lui-même. */
function leadTitle(lead: Lead) {
  return lead.company_name?.trim() || `${lead.first_name} ${lead.last_name}`.trim() || lead.email;
}

function contactName(lead: Lead) {
  return `${lead.first_name} ${lead.last_name}`.trim();
}

export function LeadList() {
  const router = useRouter();
  const { canDelete } = usePermissions();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<LeadStatus | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editStartsInEditMode, setEditStartsInEditMode] = useState(false);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);

  useEffect(() => {
    // listUsers() is Super-Admin/RH/Responsable Marketing only (server
    // side) — a Commercial can view and work leads but can't reassign
    // them, so a 403 there is expected and must not block the leads
    // themselves from loading; it only means the assignee picker stays
    // empty for that role.
    Promise.all([listLeads(), listUsers().catch(() => ({ results: [] as UserBrief[] }))])
      .then(([leadsRes, usersRes]) => {
        setLeads(leadsRes.results);
        setUsers(usersRes.results);
      })
      .catch(() => setError("Impossible de charger les leads."));
  }, []);

  async function handleStatusChange(lead: Lead, status: LeadStatus) {
    setSavingId(lead.id);
    setActionError(null);
    try {
      const updated = await updateLead(lead.id, { status });
      setLeads((prev) => prev && prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch {
      setActionError(`Impossible de mettre à jour le statut de ${leadTitle(lead)}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleAssign(lead: Lead, userId: string) {
    setSavingId(lead.id);
    setActionError(null);
    try {
      const updated = await updateLead(lead.id, { assigned_to_id: userId || null });
      setLeads((prev) => prev && prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch {
      setActionError(`Impossible de réassigner ${leadTitle(lead)}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(lead: Lead) {
    await deleteLead(lead.id);
    setLeads((prev) => prev && prev.filter((l) => l.id !== lead.id));
    if (editLead?.id === lead.id) setEditLead(null);
  }

  function openLead(lead: Lead, inEditMode = false) {
    setEditStartsInEditMode(inEditMode);
    setEditLead(lead);
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

  const allowDelete = canDelete("leads");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Tunnel commercial</h1>
          <p className="text-sm text-neutral-500">
            Glissez une carte pour changer son statut, cliquez pour le détail, ou faites un clic droit pour
            les actions rapides. Un lead converti devient automatiquement client.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-full px-4 shadow-sm">
          <Plus className="size-4" /> Nouveau lead
        </Button>
      </div>

      {actionError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {actionError}
        </p>
      )}

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
                {laneLeads.map((lead) => {
                  const title = leadTitle(lead);
                  const person = contactName(lead);
                  return (
                    <ContextMenu
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggedId(lead.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onClick={() => openLead(lead)}
                      className={cn(
                        "cursor-grab rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm transition-opacity active:cursor-grabbing data-[popup-open]:ring-2 data-[popup-open]:ring-primary/30",
                        draggedId === lead.id && "opacity-40",
                        savingId === lead.id && "pointer-events-none opacity-60"
                      )}
                      menu={
                        <>
                          <ContextMenuLabel>{title}</ContextMenuLabel>
                          <ContextMenuItem icon={Eye} onClick={() => openLead(lead)}>
                            Ouvrir la fiche
                          </ContextMenuItem>
                          <ContextMenuItem icon={Pencil} onClick={() => openLead(lead, true)}>
                            Modifier
                          </ContextMenuItem>
                          <ContextMenuSubmenu label="Changer le statut" icon={ArrowRightLeft}>
                            {LANE_ORDER.map((target) => (
                              <ContextMenuItem
                                key={target}
                                disabled={target === lead.status}
                                onClick={() => handleStatusChange(lead, target)}
                              >
                                {STATUS_LABELS[target]}
                                {target === "CONVERTI" && target !== lead.status && (
                                  <span className="ml-auto pl-3 text-[0.65rem] text-neutral-400">→ client</span>
                                )}
                              </ContextMenuItem>
                            ))}
                          </ContextMenuSubmenu>
                          {lead.client && (
                            <ContextMenuItem
                              icon={Building2}
                              onClick={() => router.push(`/admin/rh/clients/${lead.client}`)}
                            >
                              Voir la fiche client
                            </ContextMenuItem>
                          )}
                          {lead.email && (
                            <ContextMenuItem icon={Mail} onClick={() => window.open(`mailto:${lead.email}`)}>
                              Envoyer un e-mail
                            </ContextMenuItem>
                          )}
                          {lead.phone && (
                            <ContextMenuItem icon={Phone} onClick={() => window.open(`tel:${lead.phone}`)}>
                              Appeler
                            </ContextMenuItem>
                          )}
                          {allowDelete && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem icon={Trash2} destructive onClick={() => setLeadToDelete(lead)}>
                                Supprimer
                              </ContextMenuItem>
                            </>
                          )}
                        </>
                      }
                    >
                      <div className="flex items-start gap-1.5">
                        <Building2 className="mt-0.5 size-3.5 shrink-0 text-neutral-400" />
                        {/* Nom complet affiché, sur plusieurs lignes si besoin : couper
                         * par « … » cachait la fin des raisons sociales longues. */}
                        <p className="min-w-0 flex-1 text-sm leading-snug font-semibold break-words text-neutral-900">{title}</p>
                      </div>
                      {lead.company_name?.trim() && person && (
                        <p className="mt-0.5 flex items-start gap-1 text-xs text-neutral-400">
                          <User className="mt-0.5 size-3 shrink-0" />
                          <span className="min-w-0 break-words">{person}</span>
                        </p>
                      )}
                      {!lead.company_name?.trim() && lead.email && (
                        <p className="mt-0.5 text-xs break-all text-neutral-400">{lead.email}</p>
                      )}

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="truncate text-[0.65rem] text-neutral-400">{SOURCE_LABELS[lead.source]}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium ${SCORE_COLOR(lead.qualification_score)}`}>
                          {lead.qualification_score}
                        </span>
                      </div>

                      {lead.client && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700">
                          <Building2 className="size-3" /> Client
                        </span>
                      )}

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
                    </ContextMenu>
                  );
                })}

                {laneLeads.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-neutral-300">Aucun lead</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Suppression demandée depuis le clic droit */}
      <ConfirmModal
        open={leadToDelete !== null}
        onOpenChange={(open) => !open && setLeadToDelete(null)}
        title="Supprimer le lead"
        description={
          leadToDelete
            ? `Supprimer définitivement « ${leadTitle(leadToDelete)} » ? Cette action est irréversible.`
            : ""
        }
        onConfirm={async () => {
          if (leadToDelete) await handleDelete(leadToDelete);
        }}
      />

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
        startInEditMode={editStartsInEditMode}
        users={users}
        onSaved={handleUpdated}
        onDelete={allowDelete ? handleDelete : undefined}
      />
    </div>
  );
}
