"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalTrigger, ModalContent, ModalClose } from "@/components/ui/modal";
import { listDepartments, listRoles, setUserRole, updateRolePermissions } from "@/lib/api/hr";
import type { Department, Role } from "@/lib/api/types";
import { ROLE_LABELS, ROLES_BY_DEPARTMENT, DJANGO_ROLE_TO_APP_ROLE, type AppRole } from "@/lib/firebase/types";
import { PERMISSION_MODULES, MODULE_ACTIONS, ACTION_LABELS } from "@/lib/admin/permission-modules";
import { cn } from "@/lib/utils";

const STEPS = ["Département", "Rôle", "Modules", "Actions"] as const;

interface MergedUserLike {
  djangoId: string;
  name: string;
  email: string;
  role: AppRole | null;
  departmentId: string | null;
}

export function UserEditModal({
  user,
  onSaved,
  trigger,
}: {
  user: MergedUserLike;
  onSaved: () => void;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [departmentId, setDepartmentId] = useState<string | null>(user.departmentId);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(user.role);
  const [modulePermissions, setModulePermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDepartmentId(user.departmentId);
    setSelectedRole(user.role);
    setError(null);
    setLoading(true);
    Promise.all([listDepartments(), listRoles()])
      .then(([deptRes, roleRes]) => {
        setDepartments(deptRes.results);
        setRoles(roleRes.results);
      })
      .catch(() => setError("Impossible de charger les départements/rôles."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentDepartment = departments.find((d) => d.id === departmentId) ?? null;
  const rolesForDepartment: AppRole[] = currentDepartment
    ? ROLES_BY_DEPARTMENT[currentDepartment.name] ?? (Object.keys(ROLE_LABELS) as AppRole[])
    : [];

  const roleRow = useMemo(
    () => (selectedRole ? roles.find((r) => DJANGO_ROLE_TO_APP_ROLE[r.name] === selectedRole) ?? null : null),
    [roles, selectedRole]
  );

  useEffect(() => {
    if (roleRow) setModulePermissions(roleRow.permissions ?? {});
  }, [roleRow]);

  function toggleModule(key: string) {
    setModulePermissions((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = ["voir"];
      }
      return next;
    });
  }

  function toggleAction(moduleKey: string, action: string) {
    setModulePermissions((prev) => {
      const current = prev[moduleKey] ?? [];
      const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];
      return { ...prev, [moduleKey]: next };
    });
  }

  async function handleFinish() {
    if (!selectedRole) return;
    setSaving(true);
    setError(null);
    try {
      await setUserRole(user.djangoId, { role: selectedRole, department_id: departmentId ?? undefined });
      if (roleRow) {
        await updateRolePermissions(roleRow.id, modulePermissions);
      }
      onSaved();
      setOpen(false);
    } catch {
      setError("Impossible d'enregistrer ces modifications.");
    } finally {
      setSaving(false);
    }
  }

  function canAdvance(): boolean {
    if (step === 0) return Boolean(departmentId);
    if (step === 1) return Boolean(selectedRole);
    return true;
  }

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <ModalTrigger render={trigger} />
      <ModalContent title={`Modifier — ${user.name || user.email}`} className="max-w-3xl">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Left timeline */}
            <div className="w-40 shrink-0">
              {STEPS.map((label, i) => (
                <div key={label} className="relative flex gap-3 pb-8 last:pb-0">
                  {i < STEPS.length - 1 && (
                    <span
                      className={cn(
                        "absolute left-[11px] top-6 h-full w-px",
                        i < step ? "bg-primary" : "bg-neutral-200"
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "z-10 flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      i < step
                        ? "bg-primary text-primary-foreground"
                        : i === step
                          ? "bg-neutral-900 text-white"
                          : "bg-neutral-100 text-neutral-400"
                    )}
                  >
                    {i < step ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <span className={cn("pt-0.5 text-xs font-medium", i <= step ? "text-neutral-900" : "text-neutral-400")}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Step content */}
            <div className="min-h-[320px] flex-1">
              {error && (
                <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                  {error}
                </p>
              )}

              {step === 0 && (
                <div>
                  <p className="mb-3 text-sm font-semibold text-neutral-900">Choisir un département</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {departments.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => { setDepartmentId(d.id); setSelectedRole(null); }}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                          departmentId === d.id
                            ? "border-primary/50 bg-primary/5 text-neutral-900"
                            : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                        )}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <p className="mb-3 text-sm font-semibold text-neutral-900">
                    Rôles de {currentDepartment?.name}
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {rolesForDepartment.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRole(r)}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                          selectedRole === r
                            ? "border-primary/50 bg-primary/5 text-neutral-900"
                            : "border-neutral-200 text-neutral-600 hover:border-neutral-300"
                        )}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                    {rolesForDepartment.length === 0 && (
                      <p className="col-span-2 text-xs text-neutral-400">Aucun rôle prédéfini pour ce département.</p>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-neutral-900">
                    Modules pour {selectedRole && ROLE_LABELS[selectedRole]}
                  </p>
                  <p className="mb-3 text-xs text-neutral-500">Coche les modules auxquels ce rôle doit avoir accès.</p>
                  <div className="max-h-72 space-y-1 overflow-y-auto">
                    {PERMISSION_MODULES.map((m) => (
                      <label
                        key={m.key}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(modulePermissions[m.key])}
                          onChange={() => toggleModule(m.key)}
                          className="size-4 rounded border-neutral-300 text-primary focus:ring-primary/40"
                        />
                        {m.label}
                        <span className="ml-auto text-[10px] text-neutral-400">{m.section}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-neutral-900">Actions par module</p>
                  <p className="mb-3 text-xs text-neutral-500">Pour chaque module coché, choisis les actions autorisées.</p>
                  <div className="max-h-72 space-y-3 overflow-y-auto">
                    {PERMISSION_MODULES.filter((m) => modulePermissions[m.key]).map((m) => (
                      <div key={m.key} className="rounded-lg border border-neutral-200 p-3">
                        <p className="mb-2 text-xs font-semibold text-neutral-900">{m.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {MODULE_ACTIONS.map((action) => {
                            const checked = modulePermissions[m.key]?.includes(action);
                            return (
                              <button
                                key={action}
                                type="button"
                                onClick={() => toggleAction(m.key, action)}
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                                  checked ? "bg-primary/10 text-primary" : "bg-neutral-100 text-neutral-500"
                                )}
                              >
                                {ACTION_LABELS[action]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {Object.keys(modulePermissions).length === 0 && (
                      <p className="text-xs text-neutral-400">Aucun module sélectionné à l&apos;étape précédente.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between border-t border-neutral-100 pt-4">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300"
                  >
                    Retour
                  </button>
                ) : (
                  <ModalClose render={<button type="button" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300">Annuler</button>} />
                )}

                {step < STEPS.length - 1 ? (
                  <Button type="button" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)} className="rounded-full px-5">
                    Suivant
                  </Button>
                ) : (
                  <Button type="button" disabled={saving} onClick={handleFinish} className="rounded-full px-5">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
}
