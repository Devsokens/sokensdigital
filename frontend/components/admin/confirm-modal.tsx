"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalTrigger, ModalContent, ModalClose } from "@/components/ui/modal";
import { ApiError } from "@/lib/api/client";

/** Standard confirmation modal for any destructive action — always used
 * instead of firing the delete/etc. straight from the trigger, everywhere
 * in the admin area (not RH-specific). */
export function ConfirmModal({
  title,
  description,
  confirmLabel = "Supprimer",
  onConfirm,
  trigger,
  disabled,
  disabledReason,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  trigger: React.ReactElement;
  /** When true, the trigger still opens the modal (so the user can see
   * *why*), but the confirm button is disabled with disabledReason shown
   * instead of the usual description. */
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setRunning(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      const apiDetail = err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body
        ? String((err.body as { detail: unknown }).detail)
        : null;
      setError(apiDetail ?? "L'action a échoué. Réessaie.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger render={trigger} />
      <ModalContent title={title} className="max-w-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4.5" />
          </span>
          <p className="pt-1.5 text-sm text-neutral-600">{disabled ? disabledReason : description}</p>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex items-center justify-end gap-3">
          <ModalClose render={<button type="button" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300">Annuler</button>} />
          <Button
            type="button"
            disabled={running || disabled}
            onClick={handleConfirm}
            className="gap-1.5 rounded-full bg-destructive px-5 text-white hover:bg-destructive/90"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
