"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ImagePlus, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";
import {
  deleteAttachment,
  listAttachments,
  uploadAttachment,
  type AttachmentTarget,
  type DocumentAttachment,
} from "@/lib/api/attachments";

const IMAGE_RE = /\.(png|jpe?g)$/i;
const MAX_SIZE = 10 * 1024 * 1024;

/** Pièces jointes d'un devis ou d'une facture fournisseur : photos (PNG,
 * JPG — appareil photo direct sur mobile) ou PDF, 10 Mo max. Les droits
 * sont vérifiés par l'API (rôles finance). */
export function AttachmentsButton({ target, objectId, documentType, label }: {
  target: AttachmentTarget;
  objectId: string;
  documentType: "QUOTE" | "INVOICE";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DocumentAttachment[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listAttachments(target, objectId)
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => { if (!cancelled) setError("Impossible de charger les pièces."); });
    return () => { cancelled = true; };
  }, [open, target, objectId]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE) throw new Error(`${file.name} dépasse 10 Mo.`);
        const added = await uploadAttachment(target, objectId, file, documentType);
        setItems((prev) => [added, ...(prev ?? [])]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Téléversement impossible.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette pièce ?")) return;
    try {
      await deleteAttachment(id);
      setItems((prev) => prev?.filter((a) => a.id !== id) ?? null);
    } catch {
      setError("Suppression impossible.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition-colors hover:border-primary/40 hover:text-primary"
      >
        <Paperclip className="size-3.5" /> Pièces
      </button>
      {open && (
        <Modal open onOpenChange={(v) => !v && setOpen(false)}>
          <ModalContent title={`Pièces — ${label}`}>
            <div className="space-y-4">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-200 px-4 py-6 text-sm text-neutral-600 transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
                <span className="font-medium">{busy ? "Téléversement…" : "Ajouter des photos ou un PDF"}</span>
                <span className="text-xs text-neutral-400">PNG, JPG ou PDF — 10 Mo max par fichier</span>
              </button>

              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
              {items === null && !error && <Loader2 className="mx-auto size-5 animate-spin text-neutral-400" />}
              {items?.length === 0 && <p className="text-center text-xs text-neutral-400">Aucune pièce pour l&apos;instant.</p>}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {items?.map((a) => (
                  <div key={a.id} className="relative overflow-hidden rounded-lg border border-neutral-200">
                    <a href={a.file_url ?? "#"} target="_blank" rel="noopener noreferrer" className="block">
                      {a.file_url && IMAGE_RE.test(a.file_name) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- URL signée Supabase
                        <img src={a.file_url} alt={a.file_name} className="aspect-square w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="flex aspect-square w-full items-center justify-center bg-neutral-50">
                          <FileText className="size-8 text-neutral-400" />
                        </span>
                      )}
                      <span className="block truncate px-2 py-1.5 text-[11px] text-neutral-600">{a.file_name}</span>
                    </a>
                    <button
                      type="button"
                      aria-label="Supprimer"
                      onClick={() => handleDelete(a.id)}
                      className="absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full bg-white/90 text-destructive shadow-sm"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </ModalContent>
        </Modal>
      )}
    </>
  );
}
