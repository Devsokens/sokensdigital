"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet";
import { Modal, ModalTrigger, ModalContent, ModalClose } from "@/components/ui/modal";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { SelectSearch } from "@/components/admin/multi-select-search";
import { BesoinViewerModal } from "@/components/admin/technique/besoin-viewer-modal";
import { todayIso } from "@/components/admin/technique/task-overdue";
import { formatFcfa } from "@/lib/format-currency";
import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles } from "@/lib/firebase/types";
import {
  approveDisbursementRequest,
  createDisbursementRequest,
  executeDisbursementRequest,
  listDisbursementRequests,
  uploadDisbursementQuote,
} from "@/lib/api/finance";
import { listProjects } from "@/lib/api/projects";
import { ApiError } from "@/lib/api/client";
import { listUsers } from "@/lib/api/hr";
import { getMe } from "@/lib/api/me";
import { useIsGerant } from "@/lib/admin/use-is-gerant";
import type { DisbursementRequest, DisbursementStatus, Project, UserBrief } from "@/lib/api/types";

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

function canApproveStage(roles: string[], stage: DisbursementStatus, isGerant: boolean): boolean {
  if (roles.includes("SUPER_ADMIN")) return true;
  if (stage === "EN_ATTENTE_RCF") return roles.includes("COMPTABLE") || roles.includes("DIRECTEUR_FINANCIER");
  return isGerant; // Gérant désigné (Administration > Utilisateurs)
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function personName(user: UserBrief | null) {
  return user ? `${user.first_name} ${user.last_name}`.trim() || user.email : "—";
}

export function DisbursementList() {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<DisbursementRequest[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<DisbursementRequest | null>(null);

  const myRoles = profileRoles(profile);
  const isGerant = useIsGerant();
  const canExecute = myRoles.includes("COMPTABLE") || myRoles.includes("SUPER_ADMIN");

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
      const [reqRes, projRes] = await Promise.all([listDisbursementRequests(), listProjects({ pageSize: 500 })]);
      setRequests(reqRes.results);
      setProjects(projRes.results);
    } catch {
      setError("Impossible de charger les besoins.");
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Besoins</h1>
          <p className="text-sm text-neutral-500">
            Chaque besoin est examiné par la Responsable Comptable et Financière, puis validé ou refusé par le
            Gérant — quel que soit le montant.
          </p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button data-tour="module-technique-decaissements" className="gap-1.5 rounded-full px-4">
                <Plus className="size-4" /> Exprimer un besoin
              </Button>
            }
          />
          <SheetContent title="Exprimer un besoin" className="max-w-3xl">
            <BesoinForm
              projects={projects}
              onCancel={() => setOpen(false)}
              onSaved={() => {
                setOpen(false);
                load();
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-sm">
        <table className="table-responsive w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Réf.</th>
              <th className="px-4 py-3 font-medium">Besoin</th>
              <th className="px-4 py-3 font-medium">Bénéficiaire</th>
              <th className="px-4 py-3 font-medium">Projet</th>
              <th className="px-4 py-3 text-right font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Demandé par</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {requests.map((req) => {
              const isPending = req.status === "EN_ATTENTE_RCF" || req.status === "EN_ATTENTE_GERANT";
              const canApproveThis = isPending && canApproveStage(myRoles, req.status, isGerant);
              const firstLine = req.lines[0]?.label ?? req.reason;
              const otherLines = Math.max(req.lines.length - 1, 0);
              return (
                <tr key={req.id} className="align-top">
                  <td className="px-4 py-3" data-label="Réf.">
                    <p className="font-mono text-xs font-semibold whitespace-nowrap text-neutral-900">{req.reference ?? "—"}</p>
                    <p className="text-xs whitespace-nowrap text-neutral-400">{formatDate(req.request_date)}</p>
                  </td>
                  <td className="px-4 py-3" data-label="Besoin">
                    <p className="max-w-xs truncate text-neutral-900" title={req.reason}>{firstLine || "—"}</p>
                    <p className="flex items-center gap-2 text-xs text-neutral-400">
                      {req.lines.length > 0 && (
                        <span>{req.lines.length} ligne{req.lines.length > 1 ? "s" : ""}{otherLines > 0 ? ` (+${otherLines})` : ""}</span>
                      )}
                      {(req.quotes_count ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Paperclip className="size-3" /> {req.quotes_count} devis
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-neutral-700" data-label="Bénéficiaire">{req.beneficiary}</td>
                  <td className="px-4 py-3 text-neutral-500" data-label="Projet">{req.project_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono whitespace-nowrap text-neutral-900" data-label="Montant">
                    {formatFcfa(req.amount)}
                  </td>
                  <td className="px-4 py-3" data-label="Statut">
                    <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_COLORS[req.status]}`}>
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
                  <td className="px-4 py-3 text-neutral-500" data-label="Demandé par">{personName(req.requested_by)}</td>
                  <td className="px-4 py-3" data-label="Actions">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewing(req)}
                        className="flex items-center gap-1 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                      >
                        <Eye className="size-3.5" /> Voir
                      </button>
                      {canApproveThis && (
                        <>
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
                        </>
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
                    </div>
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-400">
                  Aucun besoin pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewing && <BesoinViewerModal request={viewing} onClose={() => setViewing(null)} />}
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
      <ModalContent title="Rejeter le besoin" className="max-w-sm">
        <label className="block">
          <span className={labelClass}>Motif du rejet (obligatoire)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className={`${inputClass} resize-none`} required />
        </label>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
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

type LineDraft = { key: number; label: string; quantity: string; unitPrice: string };

function lineTotal(line: LineDraft) {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  return Number.isFinite(quantity) && Number.isFinite(unitPrice) ? quantity * unitPrice : 0;
}

function BesoinForm({ projects, onSaved, onCancel }: { projects: Project[]; onSaved: () => void; onCancel: () => void }) {
  const [requestDate, setRequestDate] = useState(todayIso);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);
  const nextKey = useRef(1);
  const [lines, setLines] = useState<LineDraft[]>([{ key: 0, label: "", quantity: "1", unitPrice: "" }]);
  const [quotes, setQuotes] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bénéficiaire par défaut : la personne qui exprime le besoin.
  useEffect(() => {
    listUsers().then((data) => setUsers(data.results)).catch(() => setUsers([]));
    getMe().then((me) => setBeneficiaryId((current) => current ?? me.id)).catch(() => {});
  }, []);

  const grandTotal = useMemo(() => lines.reduce((sum, line) => sum + lineTotal(line), 0), [lines]);

  function updateLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, { key: nextKey.current++, label: "", quantity: "1", unitPrice: "" }]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const filled = lines.filter((l) => l.label.trim() || l.unitPrice);
    if (filled.length === 0) {
      setError("Ajoutez au moins une ligne.");
      return;
    }
    if (filled.some((l) => !l.label.trim() || !(Number(l.quantity) > 0) || !(Number(l.unitPrice) >= 0) || l.unitPrice === "")) {
      setError("Chaque ligne doit avoir un intitulé, un nombre d'unités positif et un prix unitaire.");
      return;
    }
    if (!beneficiaryId) {
      setError("Choisissez le bénéficiaire.");
      return;
    }
    setSaving(true);
    try {
      const created = await createDisbursementRequest({
        request_date: requestDate,
        project_id: projectId,
        beneficiary_user_id: beneficiaryId,
        lines: filled.map((l) => ({ label: l.label.trim(), quantity: l.quantity, unit_price: l.unitPrice })),
      });
      // Les devis ont besoin de l'id du besoin : envoyés juste après.
      const failed: string[] = [];
      for (const file of quotes) {
        try {
          await uploadDisbursementQuote(created.id, file);
        } catch {
          failed.push(file.name);
        }
      }
      if (failed.length > 0) {
        alert(`Besoin ${created.reference ?? ""} enregistré, mais ces devis n'ont pas pu être joints : ${failed.join(", ")}.`);
      }
      onSaved();
    } catch (e) {
      // Motif exact renvoyé par l'API (droits sur le projet, projet annulé,
      // ligne invalide…) plutôt qu'un message générique.
      const body = e instanceof ApiError ? (e.body as Record<string, unknown> | null) : null;
      const first = body ? (body.detail ?? Object.values(body)[0]) : null;
      const detail = Array.isArray(first) ? first[0] : first;
      setError(typeof detail === "string" ? detail : "Impossible d'enregistrer le besoin.");
    } finally {
      setSaving(false);
    }
  }

  const userOptions = users.map((u) => ({
    id: u.id,
    label: `${u.first_name} ${u.last_name}`.trim() || u.email,
    sublabel: u.department_name || undefined,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Date de la demande</span>
          <input type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} className={inputClass} required />
        </label>
        <label className="block">
          <span className={labelClass}>Bénéficiaire</span>
          <SelectSearch options={userOptions} value={beneficiaryId} onChange={setBeneficiaryId} placeholder="Choisir une personne…" />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Projet (facultatif)</span>
        <select value={projectId ?? ""} onChange={(e) => setProjectId(e.target.value || null)} className={inputClass}>
          <option value="">— Aucun projet —</option>
          {/* Tous les projets, y compris déjà lancés ou en cours d'exécution :
              un besoin peut survenir à tout moment de la vie du projet.
              Projets actifs d'abord, annulés exclus. */}
          {[...projects]
            .filter((p) => p.status !== "ANNULE")
            .sort((a, b) => Number(a.status === "TERMINE") - Number(b.status === "TERMINE") || a.name.localeCompare(b.name, "fr"))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.status === "EN_COURS" ? " — en cours" : p.status === "TERMINE" ? " — terminé" : ""}
              </option>
            ))}
        </select>
      </label>

      <div>
        <span className={labelClass}>Lignes du besoin</span>
        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-neutral-50 text-left text-[11px] text-neutral-500 uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Intitulé</th>
                <th className="w-24 px-3 py-2 font-medium">Unités</th>
                <th className="w-36 px-3 py-2 font-medium">Prix unitaire</th>
                <th className="w-36 px-3 py-2 text-right font-medium">Total</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lines.map((line) => (
                <tr key={line.key}>
                  <td className="px-2 py-1.5">
                    <input
                      value={line.label}
                      onChange={(e) => updateLine(line.key, { label: e.target.value })}
                      placeholder="Ex. Écran 27 pouces"
                      className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm focus:border-primary/50 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm focus:border-primary/50 focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.unitPrice}
                      onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                      placeholder="FCFA"
                      className="w-full rounded-md border border-neutral-200 px-2.5 py-1.5 text-sm focus:border-primary/50 focus:outline-none"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono whitespace-nowrap text-neutral-800">{formatFcfa(lineTotal(line))}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      disabled={lines.length === 1}
                      className="text-neutral-400 hover:text-destructive disabled:opacity-30"
                      aria-label="Supprimer la ligne"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td colSpan={3} className="px-3 py-2">
                  <button type="button" onClick={addLine} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Plus className="size-3.5" /> Ajouter une ligne
                  </button>
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold whitespace-nowrap text-neutral-900">{formatFcfa(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div>
        <span className={labelClass}>Devis (un ou plusieurs)</span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.doc"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            setQuotes((prev) => [...prev, ...picked]);
            e.target.value = "";
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 px-4 py-4 text-sm text-neutral-500 transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Upload className="size-4" /> Joindre des devis (PDF, image — 15 Mo max chacun)
        </button>
        {quotes.length > 0 && (
          <ul className="mt-2 space-y-1">
            {quotes.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700">
                <span className="flex min-w-0 items-center gap-1.5">
                  <Paperclip className="size-3.5 shrink-0 text-neutral-400" />
                  <span className="truncate">{file.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setQuotes((prev) => prev.filter((_, j) => j !== index))}
                  className="ml-2 shrink-0 text-neutral-400 hover:text-destructive"
                  aria-label={`Retirer ${file.name}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
        <Button type="button" onClick={onCancel} className="rounded-full border border-neutral-200 bg-white px-4 text-neutral-700 hover:bg-neutral-50">
          Annuler
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-500">
            Total : <strong className="font-mono text-neutral-900">{formatFcfa(grandTotal)}</strong>
          </span>
          <Button type="submit" disabled={saving} className="rounded-full px-5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Envoyer le besoin"}
          </Button>
        </div>
      </div>
    </form>
  );
}
