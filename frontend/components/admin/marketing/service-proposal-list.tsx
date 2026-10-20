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
import type { ServiceProposal } from "@/lib/api/types";
import {
  listServiceProposals,
  deleteServiceProposal,
} from "@/lib/api/documents-service";
import { ServiceProposalViewerModal } from "@/components/admin/marketing/service-proposal-viewer-modal";
import { SendDocumentModal } from "@/components/admin/marketing/send-document-modal";
import { sendServiceProposalByEmail } from "@/lib/api/documents-service";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  BROUILLON: "Brouillon",
  ENVOYE: "Envoyé",
  ACCEPTE: "Accepté",
  REFUSE: "Refusé",
};

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: "bg-neutral-100 text-neutral-600",
  ENVOYE: "bg-sky-100 text-sky-800",
  ACCEPTE: "bg-emerald-100 text-emerald-800",
  REFUSE: "bg-rose-100 text-rose-800",
};

function formatDate(val: string | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ServiceProposalList({
  basePath = "/admin/marketing/offres-de-service",
}: {
  basePath?: string;
}) {
  const [proposals, setProposals] = useState<ServiceProposal[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState<ServiceProposal | null>(null);
  const [sendingProposal, setSendingProposal] = useState<ServiceProposal | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await listServiceProposals();
      setProposals(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: string) {
    await deleteServiceProposal(id);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Offres de service</h1>
          <p className="text-sm text-neutral-500">
            Propositions commerciales et techniques envoyées aux prospects et clients.
          </p>
        </div>
        <Link href={`${basePath}/nouveau`}>
          <Button className="gap-1.5 rounded-full px-4 shadow-sm">
            <Plus className="size-4" /> Nouvelle offre
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
                <th className="px-4 py-3 font-medium">N° Offre</th>
                <th className="px-4 py-3 font-medium">Client / Organisation</th>
                <th className="px-4 py-3 font-medium">Titre de la proposition</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Création / Envoi</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {proposals &&
                proposals.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-mono font-semibold text-neutral-900">
                      <button
                        type="button"
                        onClick={() => setViewing(item)}
                        className="text-primary hover:underline flex items-center gap-1.5"
                      >
                        <FileText className="size-3.5 text-neutral-400" />
                        {item.proposal_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-neutral-800 font-medium">{item.client_name}</td>
                    <td className="px-4 py-3 text-neutral-600 max-w-xs truncate">{item.title}</td>
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
                    <td className="px-4 py-3 text-xs text-neutral-500">
                      {item.sent_at ? `Envoyé le ${formatDate(item.sent_at)}` : formatDate(item.created_at)}
                    </td>
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
                            onClick={() => setSendingProposal(item)}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                          >
                            <Mail className="size-3.5" /> Envoyer par mail
                          </button>
                          <ConfirmModal
                            title="Supprimer l'offre"
                            description={`Supprimer définitivement "${item.proposal_number}" ? Cette action est irréversible.`}
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
              {proposals && proposals.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                    Aucune offre de service pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Visualiseur modal */}
      {viewing && (
        <ServiceProposalViewerModal
          proposal={viewing}
          onClose={() => setViewing(null)}
          onUpdated={() => load()}
        />
      )}

      {/* Modal d'envoi rapide */}
      {sendingProposal && (
        <SendDocumentModal
          open={Boolean(sendingProposal)}
          onOpenChange={(isOpen) => !isOpen && setSendingProposal(null)}
          documentTitle={sendingProposal.title}
          documentNumber={sendingProposal.proposal_number}
          recipientName={sendingProposal.client_name}
          suggestedEmails={[]}
          onSend={async (emails, msg) => {
            await sendServiceProposalByEmail(sendingProposal.id, emails, msg);
            load();
          }}
        />
      )}
    </div>
  );
}
