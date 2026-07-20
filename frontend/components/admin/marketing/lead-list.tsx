"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listLeads, updateLead } from "@/lib/api/marketing";
import { listUsers } from "@/lib/api/hr";
import type { Lead, LeadStatus, UserBrief } from "@/lib/api/types";
import { inputClass } from "@/components/admin/form-styles";

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOUVEAU: "Nouveau",
  QUALIFIE: "Qualifié",
  PROPOSITION_EN_COURS: "Proposition en cours",
  PERDU: "Perdu",
  CONVERTI: "Converti",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  NOUVEAU: "bg-primary/10 text-primary",
  QUALIFIE: "bg-emerald-100 text-emerald-700",
  PROPOSITION_EN_COURS: "bg-amber-100 text-amber-700",
  PERDU: "bg-neutral-100 text-neutral-500",
  CONVERTI: "bg-emerald-600/10 text-emerald-800",
};

export function LeadList() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    try {
      const [leadsRes, usersRes] = await Promise.all([listLeads(), listUsers()]);
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

  async function handleScoreChange(lead: Lead, score: number) {
    setSavingId(lead.id);
    try {
      const updated = await updateLead(lead.id, { qualification_score: score });
      setLeads((prev) => prev && prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch {
      setError(`Impossible de mettre à jour le score de ${lead.first_name} ${lead.last_name}.`);
    } finally {
      setSavingId(null);
    }
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
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Leads</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Un Commercial ne voit que ses propres leads assignés ; le Responsable Marketing voit tout.
      </p>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Assigné à</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td className="px-4 py-3">
                  <p className="text-neutral-900">{lead.first_name} {lead.last_name}</p>
                  <p className="text-xs text-neutral-400">{lead.company_name || lead.email}</p>
                </td>
                <td className="px-4 py-3 text-neutral-500">{lead.source}</td>
                <td className="px-4 py-3">
                  <select
                    value={lead.status}
                    onChange={(e) => handleStatusChange(lead, e.target.value as LeadStatus)}
                    disabled={savingId === lead.id}
                    className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${STATUS_COLORS[lead.status]}`}
                  >
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={lead.qualification_score}
                    onBlur={(e) => handleScoreChange(lead, Number(e.target.value))}
                    disabled={savingId === lead.id}
                    className={`${inputClass} w-20 py-1.5`}
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={lead.assigned_to?.id ?? ""}
                    onChange={(e) => handleAssign(lead, e.target.value)}
                    disabled={savingId === lead.id}
                    className={`${inputClass} py-1.5`}
                  >
                    <option value="">— Non assigné —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  Aucun lead pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
