"use client";

import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Mail, Send, X, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { cn } from "@/lib/utils";

export interface SendDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentTitle: string;
  documentNumber: string;
  suggestedEmails: string[];
  recipientName?: string;
  onSend: (emails: string[], message: string) => Promise<void>;
}

export function SendDocumentModal({
  open,
  onOpenChange,
  documentTitle,
  documentNumber,
  suggestedEmails,
  recipientName,
  onSend,
}: SendDocumentModalProps) {
  const [selectedEmails, setSelectedEmails] = useState<string[]>(
    suggestedEmails.length > 0 ? suggestedEmails : []
  );
  const [newEmail, setNewEmail] = useState("");
  const [message, setMessage] = useState(
    `Bonjour ${recipientName || ""},\n\nVeuillez trouver ci-joint les éléments relatifs à "${documentTitle}" (${documentNumber}).\nNous restons à votre entière disposition pour tout échange complémentaire.\n\nCordialement,\nL'équipe Soken's Digital`
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchroniser si suggestedEmails change
  function toggleEmail(email: string) {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  }

  function handleAddEmail(e: React.FormEvent) {
    e.preventDefault();
    const clean = newEmail.trim();
    if (!clean) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError("Adresse e-mail invalide.");
      return;
    }
    if (!selectedEmails.includes(clean)) {
      setSelectedEmails((prev) => [...prev, clean]);
    }
    setNewEmail("");
    setError(null);
  }

  async function handleConfirmSend() {
    if (selectedEmails.length === 0) {
      setError("Veuillez sélectionner ou ajouter au moins une adresse e-mail.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      await onSend(selectedEmails, message);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi de l'e-mail.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl bg-white p-6 shadow-2xl",
            "transition-all duration-200 ease-out",
            "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
          )}
        >
          <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="size-4" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-neutral-900">
                  Envoyer par e-mail
                </Dialog.Title>
                <p className="text-xs text-neutral-500">
                  {documentNumber} — {documentTitle}
                </p>
              </div>
            </div>
            <Dialog.Close
              aria-label="Fermer"
              className="rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <div>
              <span className={labelClass}>Destinataires (contacts rattachés)</span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {suggestedEmails.map((email) => {
                  const isChecked = selectedEmails.includes(email);
                  return (
                    <button
                      key={email}
                      type="button"
                      onClick={() => toggleEmail(email)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                        isChecked
                          ? "bg-primary text-white"
                          : "border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                      )}
                    >
                      {isChecked && <Check className="size-3" />}
                      {email}
                    </button>
                  );
                })}
              </div>

              {/* Ajouter un autre e-mail */}
              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Ajouter une autre adresse mail..."
                  className={cn(inputClass, "text-xs")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddEmail(e);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddEmail}
                  className="shrink-0 gap-1 rounded-lg px-3 text-xs"
                >
                  <Plus className="size-3.5" /> Ajouter
                </Button>
              </div>

              {selectedEmails.length > 0 && (
                <p className="mt-1.5 text-[0.7rem] text-neutral-400">
                  {selectedEmails.length} destinataire(s) sélectionné(s) : {selectedEmails.join(", ")}
                </p>
              )}
            </div>

            <div>
              <span className={labelClass}>Message d&apos;accompagnement</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className={cn(inputClass, "text-xs font-sans")}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-full px-4 text-xs"
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={sending || selectedEmails.length === 0}
              onClick={handleConfirmSend}
              className="gap-1.5 rounded-full px-5 text-xs shadow-sm"
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              {sending ? "Envoi en cours..." : "Envoyer maintenant"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
