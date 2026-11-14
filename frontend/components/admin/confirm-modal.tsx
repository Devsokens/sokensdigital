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
  open: controlledOpen,
  onOpenChange,
  requireTyping,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  /** Optional when the modal is opened from elsewhere (e.g. a right-click
   * menu item) through `open`/`onOpenChange`. */
  trigger?: React.ReactElement;
  /** When true, the trigger still opens the modal (so the user can see
   * *why*), but the confirm button is disabled with disabledReason shown
   * instead of the usual description. */
  disabled?: boolean;
  disabledReason?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Action très critique : le bouton ne s'active qu'une fois ce mot
   * recopié — seconde confirmation explicite, plutôt qu'un clic réflexe. */
  requireTyping?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const typingOk = !requireTyping || typed.trim().toUpperCase() === requireTyping.toUpperCase();

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
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        setOpen(next);
      }}
    >
      {trigger && <ModalTrigger render={trigger} />}
      <ModalContent title={title} className="max-w-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4.5" />
          </span>
          <p className="pt-1.5 text-sm text-neutral-600">{disabled ? disabledReason : description}</p>
        </div>
        {requireTyping && !disabled && (
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs text-neutral-500">
              Tapez <strong className="font-semibold text-neutral-800">{requireTyping}</strong> pour confirmer
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-destructive/50"
            />
          </label>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <ModalClose render={<button type="button" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300">Annuler</button>} />
          <Button
            type="button"
            disabled={running || disabled || !typingOk}
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
