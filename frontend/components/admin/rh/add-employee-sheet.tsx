"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { provisionUser, createEmployee, listDepartments } from "@/lib/api/hr";
import type { Department } from "@/lib/api/types";
import { ROLE_LABELS, type AppRole } from "@/lib/firebase/types";

const STEPS = ["Identité", "Accès plateforme", "Informations RH"] as const;

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "" as AppRole | "",
  departmentId: "",
  position: "",
  hireDate: "",
  grossMonthlySalary: "",
};

export function AddEmployeeSheet({
  onCreated,
  trigger,
  initialIdentity,
}: {
  onCreated: () => void;
  /** Replaces the default "Ajouter un employé" button — e.g. a
   * "Provisionner" CTA next to an already-existing, not-yet-provisioned
   * Django user row in Utilisateurs & Rôles. */
  trigger?: React.ReactElement;
  /** Pre-fills step 1 (Identité) — skips retyping name/email already known
   * from the Django user row being provisioned. */
  initialIdentity?: { firstName: string; lastName: string; email: string };
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(initialIdentity ? 1 : 0);
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    firstName: initialIdentity?.firstName ?? "",
    lastName: initialIdentity?.lastName ?? "",
    email: initialIdentity?.email ?? "",
  }));
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) listDepartments().then((d) => setDepartments(d.results)).catch(() => setDepartments([]));
  }, [open]);

  function reset() {
    setForm({
      ...EMPTY_FORM,
      firstName: initialIdentity?.firstName ?? "",
      lastName: initialIdentity?.lastName ?? "",
      email: initialIdentity?.email ?? "",
    });
    setStep(initialIdentity ? 1 : 0);
    setError(null);
  }

  function set<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function canAdvance(): boolean {
    if (step === 0) return Boolean(form.firstName && form.lastName && form.email);
    if (step === 1) return Boolean(form.password.length >= 8 && form.role);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdvance()) return;
    setError(null);
    setSaving(true);
    try {
      const user = await provisionUser({
        email: form.email,
        password: form.password,
        first_name: form.firstName,
        last_name: form.lastName,
        role: form.role as AppRole,
        department_id: form.departmentId || undefined,
      });
      await createEmployee({
        user_id: user.id,
        position: form.position,
        hire_date: form.hireDate || undefined,
        gross_monthly_salary: form.grossMonthlySalary || undefined,
      });
      onCreated();
      setOpen(false);
      reset();
    } catch {
      setError(
        "Impossible de créer cet employé — l'email est peut-être déjà utilisé, ou une étape a échoué en cours de route."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger
        render={
          trigger ?? (
            <Button data-tour="module-rh-employes" className="gap-1.5 rounded-full px-4">
              <Plus className="size-4" /> Ajouter un employé
            </Button>
          )
        }
      />
      <SheetContent title="Ajouter un employé">
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={
                  i <= step
                    ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    : "flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-400"
                }
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span className={i <= step ? "text-xs font-medium text-neutral-900" : "text-xs text-neutral-400"}>
                {label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-neutral-200" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>Prénom</span>
                  <input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputClass} required />
                </label>
                <label className="block">
                  <span className={labelClass}>Nom</span>
                  <input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputClass} required />
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>Email</span>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} required />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Mot de passe temporaire</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  className={inputClass}
                  minLength={8}
                  required
                />
                <span className="mt-1 block text-[0.7rem] text-neutral-400">Au moins 8 caractères — à communiquer à la personne, ou à lui faire réinitialiser.</span>
              </label>
              <label className="block">
                <span className={labelClass}>Rôle</span>
                <select value={form.role} onChange={(e) => set("role", e.target.value as AppRole)} className={inputClass} required>
                  <option value="">— Choisir —</option>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Département</span>
                <select value={form.departmentId} onChange={(e) => set("departmentId", e.target.value)} className={inputClass}>
                  <option value="">— Aucun —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Poste</span>
                <input value={form.position} onChange={(e) => set("position", e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Date d&apos;embauche</span>
                <input type="date" value={form.hireDate} onChange={(e) => set("hireDate", e.target.value)} className={inputClass} />
              </label>
              <label className="block">
                <span className={labelClass}>Salaire brut mensuel</span>
                <input
                  type="number"
                  value={form.grossMonthlySalary}
                  onChange={(e) => set("grossMonthlySalary", e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {step > 0 ? (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} className="gap-1 rounded-full px-4">
                <ChevronLeft className="size-4" /> Retour
              </Button>
            ) : (
              <SheetClose render={<Button type="button" variant="outline" className="rounded-full px-4">Annuler</Button>} />
            )}

            {step < STEPS.length - 1 ? (
              <Button type="button" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)} className="gap-1 rounded-full px-4">
                Suivant <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={saving} className="gap-1.5 rounded-full px-5">
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Créer l'employé"}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
