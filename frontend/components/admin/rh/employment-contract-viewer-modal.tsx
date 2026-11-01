"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Mail, Printer, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EmploymentContractDocument } from "@/lib/api/types";
import { EmploymentContractDocumentPages } from "@/components/admin/rh/employment-contract-document-pages";
import { SendDocumentModal } from "@/components/admin/marketing/send-document-modal";
import { sendEmploymentContractByEmail } from "@/lib/api/documents-service";
import { cn } from "@/lib/utils";

export function EmploymentContractViewerModal({
  contract,
  onClose,
  onUpdated,
}: {
  contract: EmploymentContractDocument;
  onClose: () => void;
  onUpdated?: (updated: EmploymentContractDocument) => void;
}) {
  const [scale, setScale] = useState(0.85);
  const [sendOpen, setSendOpen] = useState(false);
  const [currentContract, setCurrentContract] = useState<EmploymentContractDocument>(contract);

  function handlePrint() {
    window.print();
  }

  async function handleSendEmail(emails: string[], message: string) {
    const updated = await sendEmploymentContractByEmail(currentContract.id, emails, message);
    setCurrentContract(updated);
    if (onUpdated) onUpdated(updated);
  }

  return (
    <>
      <Dialog.Root open onOpenChange={(next) => !next && onClose()}>
        <Dialog.Portal>
          <Dialog.Backdrop
            className={cn(
              "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-200 print:hidden",
              "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
            )}
          />
          <Dialog.Popup
            className={cn(
              "fixed top-1/2 left-1/2 z-50 flex h-[94vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-[#dfe1e6] shadow-2xl print:m-0 print:h-auto print:w-full print:max-w-none print:translate-x-0 print:translate-y-0 print:rounded-none print:bg-white print:p-0",
              "transition-all duration-200 ease-out",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            {/* Barre d'outils du visualiseur */}
            <div className="flex shrink-0 items-center justify-between border-b border-neutral-300 bg-white px-5 py-3 shadow-sm print:hidden">
              <div className="flex items-center gap-3">
                <Dialog.Title className="text-base font-semibold text-neutral-900">
                  {currentContract.contract_number} — {currentContract.employee_name}
                </Dialog.Title>
                <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                  {currentContract.contract_type} • {currentContract.position}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    currentContract.status === "ACTIF"
                      ? "bg-emerald-100 text-emerald-800"
                      : currentContract.status === "ENVOYE"
                      ? "bg-sky-100 text-sky-800"
                      : "bg-neutral-100 text-neutral-600"
                  )}
                >
                  {currentContract.status}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="mr-2 flex items-center rounded-lg border border-neutral-200 bg-neutral-50 px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => setScale((s) => Math.max(0.4, Number((s - 0.1).toFixed(2))))}
                    aria-label="Zoom arrière"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                  >
                    <ZoomOut className="size-3.5" />
                  </button>
                  <span className="px-2 text-xs font-mono font-medium text-neutral-600">
                    {Math.round(scale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setScale((s) => Math.min(1.4, Number((s + 0.1).toFixed(2))))}
                    aria-label="Zoom avant"
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900"
                  >
                    <ZoomIn className="size-3.5" />
                  </button>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSendOpen(true)}
                  className="gap-1.5 rounded-full px-3.5 text-xs"
                >
                  <Mail className="size-3.5 text-neutral-600" /> Envoyer au salarié
                </Button>

                <Button
                  type="button"
                  onClick={handlePrint}
                  className="gap-1.5 rounded-full px-4 text-xs shadow-sm"
                >
                  <Printer className="size-3.5" /> Imprimer / PDF
                </Button>

                <Dialog.Close
                  aria-label="Fermer"
                  className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>
            </div>

            {/* Zone d'affichage défilable des pages A4 */}
            <div className="relative flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">
              <div
                className="flex flex-col items-center gap-6 print:gap-0"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease-out",
                }}
              >
                <EmploymentContractDocumentPages
                  contract={currentContract}
                  accentColor={currentContract.document_color || "#0f766e"}
                />
              </div>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal d'envoi par e-mail */}
      <SendDocumentModal
        open={sendOpen}
        onOpenChange={setSendOpen}
        documentTitle={`${currentContract.party_type === "CLIENT" ? "Contrat" : "Contrat de travail"} : ${currentContract.employee_name}`}
        documentNumber={currentContract.contract_number}
        recipientName={currentContract.employee_name}
        suggestedEmails={currentContract.employee_email ? [currentContract.employee_email] : []}
        onSend={handleSendEmail}
      />
    </>
  );
}
