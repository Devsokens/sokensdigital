"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { listDisbursementRequests, createDisbursementRequest } from "@/lib/api/finance";
import { listProjects } from "@/lib/api/projects";
import type { DisbursementRequest, DisbursementStatus, Project } from "@/lib/api/types";

const STATUS_LABELS: Record<DisbursementStatus, string> = {
  EN_ATTENTE_N1: "En attente (N1)",
  EN_ATTENTE_N2: "En attente (N2)",
  APPROUVE: "Approuvé",
  REJETE: "Rejeté",
  EXECUTE: "Exécuté",
};

const STATUS_COLORS: Record<DisbursementStatus, string> = {
  EN_ATTENTE_N1: "bg-amber-100 text-amber-700",
  EN_ATTENTE_N2: "bg-amber-100 text-amber-700",
  APPROUVE: "bg-emerald-100 text-emerald-700",
  REJETE: "bg-destructive/10 text-destructive",
  EXECUTE: "bg-primary/10 text-primary",
};

export function DisbursementList() {
  const [requests, setRequests] = useState<DisbursementRequest[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

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
            Initiation de demandes opérationnelles (N1) pour les dépenses de tes projets.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Nouvelle demande
              </Button>
            }
          />
          <SheetContent title="Nouvelle demande de décaissement">
            <RequestForm projects={projects} onSaved={() => { setOpen(false); load(); }} />
          </SheetContent>
        </Sheet>
      </div>

      <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
        Seule l&apos;initiation (N1) est disponible pour l&apos;instant — la validation hiérarchique (N2, Directeur
        Financier) et l&apos;exécution (Comptable) arriveront avec le module Comptabilité/Finance.
      </p>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Bénéficiaire</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Demandé par</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {requests.map((req) => (
              <tr key={req.id}>
                <td className="px-4 py-3">
                  <p className="text-neutral-900">{req.beneficiary}</p>
                  <p className="max-w-xs truncate text-xs text-neutral-400">{req.reason}</p>
                </td>
                <td className="px-4 py-3 text-neutral-900">{req.amount} €</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[req.status]}`}>
                    {STATUS_LABELS[req.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {req.requested_by ? `${req.requested_by.first_name} ${req.requested_by.last_name}` : "—"}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
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
        <span className={labelClass}>Montant</span>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} required />
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
