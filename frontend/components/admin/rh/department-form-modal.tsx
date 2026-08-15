"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalTrigger, ModalContent, ModalClose } from "@/components/ui/modal";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { createDepartment, updateDepartment } from "@/lib/api/hr";
import type { Department } from "@/lib/api/types";

const COLOR_SWATCHES = ["#22d3ee", "#7dd3fc", "#a5b4fc", "#5eead4", "#fcd34d", "#fca5a5", "#c4b5fd", "#86efac"];

export function DepartmentFormModal({
  department,
  onSaved,
  trigger,
}: {
  /** Present → edit mode. Absent → create mode. */
  department?: Department;
  onSaved: () => void;
  trigger?: React.ReactElement;
}) {
  const isEdit = Boolean(department);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(department?.name ?? "");
  const [description, setDescription] = useState(department?.description ?? "");
  const [color, setColor] = useState(department?.color ?? COLOR_SWATCHES[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(department?.name ?? "");
      setDescription(department?.description ?? "");
      setColor(department?.color ?? COLOR_SWATCHES[0]);
      setError(null);
    }
  }, [open, department]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit && department) {
        await updateDepartment(department.id, { name, description, color });
      } else {
        await createDepartment({ name, description, color });
      }
      onSaved();
      setOpen(false);
    } catch {
      setError("Impossible d'enregistrer ce département — le nom est peut-être déjà utilisé.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger
        render={
          trigger ?? (
            <Button className="gap-1.5 rounded-full px-4">
              <Plus className="size-4" /> Nouveau département
            </Button>
          )
        }
      />
      <ModalContent title={isEdit ? "Modifier le département" : "Nouveau département"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}
          <label className="block">
            <span className={labelClass}>Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
          </label>
          <label className="block">
            <span className={labelClass}>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Rôle de ce département, responsabilités..."
            />
          </label>
          <div>
            <span className={labelClass}>Couleur</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={swatch}
                  className="flex size-8 items-center justify-center rounded-lg ring-offset-2 transition-shadow"
                  style={{
                    backgroundColor: swatch,
                    boxShadow: color === swatch ? "0 0 0 2px white, 0 0 0 4px #171717" : undefined,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={saving} className="rounded-full px-6">
              {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Enregistrer" : "Créer"}
            </Button>
            <ModalClose render={<Button type="button" variant="outline" className="rounded-full px-5">Annuler</Button>} />
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
