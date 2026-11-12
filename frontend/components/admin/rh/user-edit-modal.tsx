"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { inputClass } from "@/components/admin/form-styles";
import { listDepartments, listRoles, setUserRole, setUserPermissions, getUserPermissions, setUserPassword } from "@/lib/api/hr";
import type { Department, Role } from "@/lib/api/types";
import { ROLE_LABELS, ROLES_BY_DEPARTMENT, DJANGO_ROLE_TO_APP_ROLE, type AppRole } from "@/lib/firebase/types";
import { PERMISSION_MODULES, MODULE_ACTIONS, ACTION_LABELS } from "@/lib/admin/permission-modules";
import { cn } from "@/lib/utils";

const STEPS = ["Département", "Rôle", "Modules", "Actions"] as const;

interface MergedUserLike {
  djangoId: string;
  name: string;
  email: string;
  roles: AppRole[];
  departmentId: string | null;
}

export function UserEditModal({
  user,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  user: MergedUserLike;
  onSaved: () => void;
  /** Optionnel quand le panneau est ouvert d'ailleurs (clic droit) via
   * `open`/`onOpenChange`. */
  trigger?: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  function setOpen(next: boolean) {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }
  const [step, setStep] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [departmentId, setDepartmentId] = useState<string | null>(user.departmentId);
  // Décision du 10/09/2026 : cumul de rôles — plusieurs sélections possibles,
  // pas un seul bouton actif.
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>(user.roles);
  const [modulePermissions, setModulePermissions] = useState<Record<string, string[]>>({});
  const [savedOverrides, setSavedOverrides] = useState<Record<string, string[]> | null>(null);

  const [showPasswordField, setShowPasswordField] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Permissions par défaut des rôles sélectionnés (union) — le point de
  // départ affiché avant toute surcharge personnelle, pour ne pas repartir
  // d'un écran vide à chaque édition.
  const roleDefaults = useMemo(() => {
    const merged: Record<string, string[]> = {};
    for (const r of roles) {
      if (selectedRoles.includes(DJANGO_ROLE_TO_APP_ROLE[r.name])) {
        for (const [key, actions] of Object.entries(r.permissions ?? {})) merged[key] = actions;
      }
    }
    return merged;
  }, [roles, selectedRoles]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDepartmentId(user.departmentId);
    setSelectedRoles(user.roles);
    setError(null);
    setShowPasswordField(false);
    setNewPassword("");
    setPasswordMessage(null);
    setLoading(true);
    // Les modules/actions (étapes 3-4) surchargent les permissions de CETTE
    // personne (User.permission_overrides) — plus le rôle partagé par tout
    // le monde l'ayant. Point de départ affiché : la surcharge déjà
    // enregistrée si elle existe, sinon ce que les rôles sélectionnés
    // accordent par défaut (fusionné une fois les rôles chargés, voir
    // l'effet séparé ci-dessous).
    Promise.all([listDepartments(), listRoles(), getUserPermissions(user.djangoId).catch(() => null)])
      .then(([deptRes, roleRes, permRes]) => {
        setDepartments(deptRes.results);
        setRoles(roleRes.results);
        setSavedOverrides(permRes?.permissions ?? null);
      })
      .catch(() => setError("Impossible de charger les départements/rôles."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (roles.length === 0) return;
    setModulePermissions(savedOverrides ?? roleDefaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles, savedOverrides]);

  const currentDepartment = departments.find((d) => d.id === departmentId) ?? null;
  const rolesForDepartment: AppRole[] = currentDepartment
    ? ROLES_BY_DEPARTMENT[currentDepartment.name] ?? (Object.keys(ROLE_LABELS) as AppRole[])
    : [];

  function toggleRole(role: AppRole) {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

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
    if (selectedRoles.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await setUserRole(user.djangoId, { roles: selectedRoles, department_id: departmentId ?? undefined });
      await setUserPermissions(user.djangoId, modulePermissions);
      onSaved();
      setOpen(false);
    } catch {
      setError("Impossible d'enregistrer ces modifications.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPassword() {
    if (newPassword.length < 8) return;
    setSettingPassword(true);
    setPasswordMessage(null);
    try {
      await setUserPassword(user.djangoId, newPassword);
      setPasswordMessage({ type: "success", text: "Mot de passe mis à jour." });
      setNewPassword("");
    } catch {
      setPasswordMessage({ type: "error", text: "Impossible de mettre à jour le mot de passe." });
    } finally {
      setSettingPassword(false);
    }
  }

  function canAdvance(): boolean {
    if (step === 0) return Boolean(departmentId);
    if (step === 1) return selectedRoles.length > 0;
    return true;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger render={trigger} />}
      <SheetContent title={`Modifier — ${user.name || user.email}`} className="max-w-2xl">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-neutral-400" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-xl border border-neutral-200 p-3.5">
              {!showPasswordField ? (
                <button
                  type="button"
                  onClick={() => setShowPasswordField(true)}
                  className="flex items-center gap-2 text-xs font-semibold text-neutral-700 hover:text-neutral-900"
                >
                  <KeyRound className="size-3.5" /> Changer le mot de passe
                </button>
              ) : (
                <div>
                  <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-neutral-700">
                    <KeyRound className="size-3.5" /> Nouveau mot de passe
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      placeholder="Au moins 8 caractères"
                      className={inputClass}
                    />
                    <Button
                      type="button"
                      disabled={settingPassword || newPassword.length < 8}
                      onClick={handleSetPassword}
                      className="shrink-0 rounded-full px-4"
                    >
                      {settingPassword ? <Loader2 className="size-4 animate-spin" /> : "Mettre à jour"}
                    </Button>
                  </div>
                  {passwordMessage && (
                    <p className={cn("mt-2 text-xs", passwordMessage.type === "success" ? "text-emerald-600" : "text-destructive")}>
                      {passwordMessage.text}
                    </p>
                  )}
                </div>
              )}
            </div>

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
                        onClick={() => { setDepartmentId(d.id); setSelectedRoles([]); }}
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
                    Rôles de {currentDepartment?.name} — plusieurs possibles
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {rolesForDepartment.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRole(r)}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                          selectedRoles.includes(r)
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
                    Modules pour {user.name || user.email}
                  </p>
                  <p className="mb-3 text-xs text-neutral-500">
                    Propre à cette personne — modifier ces permissions n&apos;affecte personne d&apos;autre, même avec
                    le même rôle.
                  </p>
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
                  <SheetClose render={<button type="button" className="rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-semibold text-neutral-600 hover:border-neutral-300">Annuler</button>} />
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
