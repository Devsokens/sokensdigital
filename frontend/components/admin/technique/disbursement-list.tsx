"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Modal, ModalTrigger, ModalContent, ModalClose } from "@/components/ui/modal";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { formatFcfa } from "@/lib/format-currency";
import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles } from "@/lib/firebase/types";
import {
  approveDisbursementRequest,
  createDisbursementRequest,
  executeDisbursementRequest,
  listDisbursementRequests,
} from "@/lib/api/finance";
import { listProjects } from "@/lib/api/projects";
import type { DisbursementRequest, DisbursementStatus, Project } from "@/lib/api/types";

const STATUS_LABELS: Record<DisbursementStatus, string> = {
  EN_ATTENTE_RCF: "En attente RCF",
  EN_ATTENTE_GERANT: "En attente Gérant",
  APPROUVE: "Approuvé",
  REJETE: "Rejeté",
  EXECUTE: "Exécuté",
};

const STATUS_COLORS: Record<DisbursementStatus, string> = {
  EN_ATTENTE_RCF: "bg-amber-100 text-amber-700",
  EN_ATTENTE_GERANT: "bg-amber-100 text-amber-700",
  APPROUVE: "bg-emerald-100 text-emerald-700",
  REJETE: "bg-destructive/10 text-destructive",
  EXECUTE: "bg-primary/10 text-primary",
};

// Process comptable et financier, "Demande de décaissement" : circuit fixe,
// aucun seuil de montant — la RCF examine d'abord, puis le Gérant statue.
const STAGE_APPROVER_LABEL: Partial<Record<DisbursementStatus, string>> = {
  EN_ATTENTE_RCF: "Responsable Comptable et Financière",
  EN_ATTENTE_GERANT: "Gérant",
};

function canApproveStage(roles: string[], stage: DisbursementStatus): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;
  if (stage === "EN_ATTENTE_RCF") return roles.includes("COMPTABLE") || roles.includes("DIRECTEUR_FINANCIER");
  return false; // Gérant : Super-Admin uniquement
}

export function DisbursementList() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<DisbursementRequest[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const myRoles = profileRoles(profile);
  const canExecute = myRoles.includes("COMPTABLE") || myRoles.includes("SUPER_ADMIN");
  const canApproveAny = myRoles.some((r) => ["COMPTABLE", "DIRECTEUR_FINANCIER", "SUPER_ADMIN"].includes(r));

  async function handleApprove(id: string, decision: "APPROUVE" | "REJETE", rejectionReason?: string) {
    setActingId(id);
    try {
      await approveDisbursementRequest(id, decision, rejectionReason);
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function handleExecute(id: string) {
    setActingId(id);
    try {
      await executeDisbursementRequest(id);
      await load();
    } finally {
      setActingId(null);
    }
  }

  async function load() {
    try {
      const [reqRes, projRes] = await Promise.all([listDisbursementRequests(), listProjects()]);
      setRequests(reqRes.results);
      setProjects(projRes.results);
    } catch {
      setError("Impossible de charger les demandes de décaissement.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!requests) {
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
          <h1 className="text-2xl font-semibold text-neutral-900">Décaissements</h1>
          <p className="text-sm text-neutral-500">
            Toute demande est examinée par la Responsable Comptable et Financière, puis validée ou refusée
            par le Gérant — quel que soit le montant.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button data-tour="module-technique-decaissements" className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Nouvelle demande
              </Button>
            }
          />
          <SheetContent title="Nouvelle demande de décaissement">
            <RequestForm projects={projects} onSaved={() => { setOpen(false); load(); }} />
          </SheetContent>
        </Sheet>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
        <table className="table-responsive w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Bénéficiaire</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Demandé par</th>
              {(canApproveAny || canExecute) && <th className="px-4 py-3 font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {requests.map((req) => {
              const isPending = req.status === "EN_ATTENTE_RCF" || req.status === "EN_ATTENTE_GERANT";
              const canApproveThis = isPending && canApproveStage(myRoles, req.status);
              return (
                <tr key={req.id}>
                  <td className="px-4 py-3" data-label="Bénéficiaire">
                    <p className="text-neutral-900">{req.beneficiary}</p>
                    <p className="max-w-xs truncate text-xs text-neutral-400">{req.reason}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-neutral-900" data-label="Montant">{formatFcfa(req.amount)}</td>
                  <td className="px-4 py-3" data-label="Statut">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[req.status]}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                    {isPending && (
                      <p className="mt-1 text-xs text-neutral-400">Validation : {STAGE_APPROVER_LABEL[req.status]}</p>
                    )}
                    {req.status === "REJETE" && req.rejection_reason && (
                      <p className="mt-1 max-w-xs truncate text-xs text-destructive" title={req.rejection_reason}>
                        Motif : {req.rejection_reason}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-500" data-label="Demandé par">
                    {req.requested_by ? `${req.requested_by.first_name} ${req.requested_by.last_name}` : "—"}
                  </td>
                  {(canApproveAny || canExecute) && (
                    <td className="px-4 py-3">
                      {canApproveThis && (
                        <div className="flex gap-2">
                          <button
                            disabled={actingId === req.id}
                            onClick={() => handleApprove(req.id, "APPROUVE")}
                            className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700 disabled:opacity-40"
                          >
                            Approuver
                          </button>
                          <RejectModal
                            disabled={actingId === req.id}
                            onReject={(reasonText) => handleApprove(req.id, "REJETE", reasonText)}
                          />
                        </div>
                      )}
                      {canExecute && req.status === "APPROUVE" && (
                        <button
                          disabled={actingId === req.id}
                          onClick={() => handleExecute(req.id)}
                          className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary disabled:opacity-40"
                        >
                          Marquer exécuté
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  Aucune demande pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RejectModal({ onReject, disabled }: { onReject: (reason: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  function handleConfirm() {
    if (!reason.trim()) return;
    onReject(reason.trim());
    setReason("");
    setOpen(false);
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger
        render={
          <button
            disabled={disabled}
            className="rounded-full bg-destructive/10 px-3 py-1 text-xs text-destructive disabled:opacity-40"
          >
            Rejeter
          </button>
        }
      />
      <ModalContent title="Rejeter la demande" className="max-w-sm">
        <label className="block">
          <span className={labelClass}>Motif du rejet (obligatoire)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputClass} resize-none`} required />
        </label>
        <div className="mt-5 flex items-center justify-end gap-3">
          <ModalClose render={<button type="button" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300">Annuler</button>} />
          <Button
            type="button"
            disabled={!reason.trim()}
            onClick={handleConfirm}
            className="gap-1.5 rounded-full bg-destructive px-5 text-white hover:bg-destructive/90"
          >
            Rejeter
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}

function RequestForm({ projects, onSaved }: { projects: Project[]; onSaved: () => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [beneficiary, setBeneficiary] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createDisbursementRequest({ project_id: projectId, amount, beneficiary, reason });
      onSaved();
    } catch {
      setError("Impossible de créer la demande — vérifie que tu diriges bien ce projet.");
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
        <span className={labelClass}>Projet</span>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass} required>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={labelClass}>Bénéficiaire</span>
        <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} className={inputClass} required />
      </label>

      <label className="block">
        <span className={labelClass}>Montant (FCFA)</span>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
        <p className="mt-1 text-xs text-neutral-400">
          Toute demande passe par la RCF puis le Gérant, quel que soit le montant.
        </p>
      </label>

      <label className="block">
        <span className={labelClass}>Motif</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputClass} min-h-24`} required />
      </label>

      <div className="flex items-center justify-between pt-2">
        <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Envoyer la demande"}
        </Button>
      </div>
    </form>
  );
}
