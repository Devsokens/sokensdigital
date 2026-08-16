"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalTrigger, ModalContent, ModalClose } from "@/components/ui/modal";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { updateEmployee } from "@/lib/api/hr";
import type { EmployeeProfile } from "@/lib/api/types";

export function EmployeeQuickEditModal({
  employee,
  onSaved,
  trigger,
}: {
  employee: EmployeeProfile;
  onSaved: () => void;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(employee.position);
  const [hireDate, setHireDate] = useState(employee.hire_date ?? "");
  const [salary, setSalary] = useState(employee.gross_monthly_salary ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateEmployee(employee.id, {
        position,
        hire_date: hireDate || undefined,
        gross_monthly_salary: String(salary),
      });
      onSaved();
      setOpen(false);
    } catch {
      setError("Impossible d'enregistrer ces modifications.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger render={trigger} />
      <ModalContent title={`Modifier — ${employee.user.first_name} ${employee.user.last_name}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}
          <label className="block">
            <span className={labelClass}>Poste</span>
            <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Date d&apos;embauche</span>
            <input type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Salaire brut mensuel (FCFA)</span>
            <input
              type="number"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </label>
          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={saving} className="rounded-full px-6">
              {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
            </Button>
            <ModalClose render={<Button type="button" variant="outline" className="rounded-full px-5">Annuler</Button>} />
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
