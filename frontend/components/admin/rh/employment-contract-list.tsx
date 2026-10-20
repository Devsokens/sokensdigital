"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import type { EmploymentContractDocument } from "@/lib/api/types";
import {
  listEmploymentContracts,
  deleteEmploymentContract,
  sendEmploymentContractByEmail,
} from "@/lib/api/documents-service";
import { EmploymentContractViewerModal } from "@/components/admin/rh/employment-contract-viewer-modal";
import { SendDocumentModal } from "@/components/admin/marketing/send-document-modal";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ACTIF: "Actif / En cours",
  ENVOYE: "Envoyé au salarié",
  TERMINE: "Terminé / Clôturé",
};

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: "bg-neutral-100 text-neutral-600",
  ACTIF: "bg-emerald-100 text-emerald-800",
  ENVOYE: "bg-sky-100 text-sky-800",
  TERMINE: "bg-neutral-200 text-neutral-700",
};

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function EmploymentContractList({
  basePath = "/admin/rh/contrats-travail",
}: {
  basePath?: string;
}) {
  const [contracts, setContracts] = useState<EmploymentContractDocument[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<EmploymentContractDocument | null>(null);
  const [sendingContract, setSendingContract] = useState<EmploymentContractDocument | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listEmploymentContracts();
      setContracts(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    await deleteEmploymentContract(id);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Contrats de travail</h1>
          <p className="text-sm text-neutral-500">
            Gestion et génération des contrats de travail, avenants et conventions pour les collaborateurs.
          </p>
        </div>
        <Link href={`${basePath}/nouveau`}>
          <Button className="gap-1.5 rounded-full px-4 shadow-sm">
            <Plus className="size-4" /> Nouveau contrat
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="table-responsive w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">N° Contrat</th>
                <th className="px-4 py-3 font-medium">Salarié / Collaborateur</th>
                <th className="px-4 py-3 font-medium">Poste & Département</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Date d&apos;effet</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {contracts &&
                contracts.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-neutral-900">
                      <button
                        type="button"
                        onClick={() => setViewing(item)}
                        className="text-primary hover:underline flex items-center gap-1.5"
                      >
                        <FileText className="size-3.5 text-neutral-400" />
                        {item.contract_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-neutral-800 font-medium">
                      <div>{item.employee_name}</div>
                      {item.employee_email && (
                        <div className="text-xs text-neutral-400">{item.employee_email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      <div>{item.position}</div>
                      {item.department && (
                        <div className="text-xs text-neutral-400">{item.department}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-neutral-700">{item.contract_type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_COLORS[item.status] || "bg-neutral-100 text-neutral-600"
                        )}
                      >
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(item.start_date)}</td>
                    <td className="px-4 py-3 text-right">
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          }
                        />
                        <PopoverContent className="w-52 p-1" align="end">
                          <button
                            type="button"
                            onClick={() => setViewing(item)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                          >
                            <Printer className="size-3.5" /> Aperçu / PDF
                          </button>
                          <Link
                            href={`${basePath}/${item.id}`}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                          >
                            <Pencil className="size-3.5" /> Modifier
                          </Link>
                          <button
                            type="button"
                            onClick={() => setSendingContract(item)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                          >
                            <Mail className="size-3.5" /> Envoyer au salarié
                          </button>
                          <ConfirmModal
                            title="Supprimer le contrat"
                            description={`Supprimer définitivement "${item.contract_number}" (${item.employee_name}) ? Cette action est irréversible.`}
                            onConfirm={() => handleDelete(item.id)}
                            trigger={
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-destructive hover:bg-destructive/5"
                              >
                                <Trash2 className="size-3.5" /> Supprimer
                              </button>
                            }
                          />
                        </PopoverContent>
                      </Popover>
                    </td>
                  </tr>
                ))}
              {contracts && contracts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-400">
                    Aucun contrat de travail pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Visualiseur modal */}
      {viewing && (
        <EmploymentContractViewerModal
          contract={viewing}
          onClose={() => setViewing(null)}
          onUpdated={() => load()}
        />
      )}

      {/* Modal d'envoi rapide */}
      {sendingContract && (
        <SendDocumentModal
          open={Boolean(sendingContract)}
          onOpenChange={(isOpen) => !isOpen && setSendingContract(null)}
          documentTitle={`Contrat de travail : ${sendingContract.employee_name}`}
          documentNumber={sendingContract.contract_number}
          recipientName={sendingContract.employee_name}
          suggestedEmails={sendingContract.employee_email ? [sendingContract.employee_email] : []}
          onSend={async (emails, msg) => {
            await sendEmploymentContractByEmail(sendingContract.id, emails, msg);
            load();
          }}
        />
      )}
    </div>
  );
}
