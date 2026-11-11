"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { listRoles } from "@/lib/api/hr";
import { getMe } from "@/lib/api/me";
import { DJANGO_ROLE_TO_APP_ROLE, profileRoles } from "@/lib/firebase/types";
import { MODULE_ACTIONS, type ModuleAction } from "@/lib/admin/permission-modules";

interface PermissionsContextValue {
  loading: boolean;
  isSuperAdmin: boolean;
  canAccessModule: (moduleKey: string) => boolean;
  hasPermission: (moduleKey: string, action: ModuleAction) => boolean;
  can: (moduleKey: string, action: ModuleAction) => boolean;
  canCreate: (moduleKey: string) => boolean;
  canEdit: (moduleKey: string) => boolean;
  canDelete: (moduleKey: string) => boolean;
  getModuleActions: (moduleKey: string) => ModuleAction[];
}

const PermissionsContext = createContext<PermissionsContextValue>({
  loading: true,
  isSuperAdmin: false,
  canAccessModule: () => false,
  hasPermission: () => false,
  can: () => false,
  canCreate: () => false,
  canEdit: () => false,
  canDelete: () => false,
  getModuleActions: () => [],
});

/** Which modules (see lib/admin/permission-modules.ts's PERMISSION_MODULES
 * keys) and actions (voir, creer, modifier, supprimer) the signed-in user's
 * role and personal overrides grant access to.
 *
 * Super-Admin always has access to everything regardless of what's stored
 * — editing that role's permissions through the UI must never be able to
 * lock the only admin account out of its own app. */
const ALWAYS_ALLOWED_MODULES = new Set(["besoins"]);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [moduleActionsMap, setModuleActionsMap] = useState<Map<string, Set<ModuleAction>>>(new Map());
  const [loading, setLoading] = useState(true);

  const myRoles = profileRoles(profile);
  const isSuperAdmin = myRoles.includes("SUPER_ADMIN");
  const needsFetch = Boolean(profile) && !isSuperAdmin;
  const myRolesKey = myRoles.join(",");

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;

    // Deux sources : les rôles (partagées par tous ceux qui ont ce rôle) et
    // la surcharge personnelle (User.permission_overrides, propre à cette
    // personne — voir backend/core/models.py::User). La surcharge REMPLACE
    // le résultat du rôle module par module : un tableau d'actions vide
    // pour un module y retire l'accès même si un rôle l'accorderait,
    // un module absent de la surcharge retombe sur l'union des rôles.
    Promise.all([listRoles(), getMe().catch(() => null)])
      .then(([rolesRes, me]) => {
        if (cancelled) return;

        // 1. Union des permissions accordées par chaque rôle de l'utilisateur
        const roleMerged = new Map<string, Set<ModuleAction>>();
        for (const row of rolesRes.results) {
          if (myRoles.includes(DJANGO_ROLE_TO_APP_ROLE[row.name])) {
            for (const [modKey, actions] of Object.entries(row.permissions ?? {})) {
              if (!roleMerged.has(modKey)) {
                roleMerged.set(modKey, new Set<ModuleAction>());
              }
              const set = roleMerged.get(modKey)!;
              for (const act of actions) {
                if (MODULE_ACTIONS.includes(act as ModuleAction)) {
                  set.add(act as ModuleAction);
                }
              }
            }
          }
        }

        // 2. Application des surcharges personnelles (permission_overrides)
        // La surcharge remplace entièrement les actions du module spécifié.
        const effectiveMap = new Map<string, Set<ModuleAction>>(roleMerged);
        if (me?.permission_overrides) {
          for (const [modKey, actions] of Object.entries(me.permission_overrides)) {
            const overrideSet = new Set<ModuleAction>();
            for (const act of actions) {
              if (MODULE_ACTIONS.includes(act as ModuleAction)) {
                overrideSet.add(act as ModuleAction);
              }
            }
            if (overrideSet.size > 0) {
              effectiveMap.set(modKey, overrideSet);
            } else {
              // Tableau d'actions vide => suppression complète de l'accès à ce module
              effectiveMap.delete(modKey);
            }
          }
        }

        setModuleActionsMap(effectiveMap);
      })
      .catch(() => {
        if (!cancelled) setModuleActionsMap(new Map());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myRolesKey, needsFetch]);

  const resolvedLoading = needsFetch ? loading : false;

  function canAccessModule(moduleKey: string): boolean {
    if (isSuperAdmin) return true;
    // Exprimer un besoin est ouvert à tout employé, quel que soit son rôle
    // (l'API borne ce que chacun voit ; la validation reste à la Finance).
    if (ALWAYS_ALLOWED_MODULES.has(moduleKey)) return true;
    const actions = moduleActionsMap.get(moduleKey);
    return Boolean(actions && actions.size > 0);
  }

  function hasPermission(moduleKey: string, action: ModuleAction): boolean {
    if (isSuperAdmin) return true;
    return Boolean(moduleActionsMap.get(moduleKey)?.has(action));
  }

  function can(moduleKey: string, action: ModuleAction): boolean {
    return hasPermission(moduleKey, action);
  }

  function canCreate(moduleKey: string): boolean {
    return hasPermission(moduleKey, "creer");
  }

  function canEdit(moduleKey: string): boolean {
    return hasPermission(moduleKey, "modifier");
  }

  function canDelete(moduleKey: string): boolean {
    return hasPermission(moduleKey, "supprimer");
  }

  function getModuleActions(moduleKey: string): ModuleAction[] {
    if (isSuperAdmin) return [...MODULE_ACTIONS];
    const actions = moduleActionsMap.get(moduleKey);
    return actions ? Array.from(actions) : [];
  }

  const value = useMemo(
    () => ({
      loading: resolvedLoading,
      isSuperAdmin,
      canAccessModule,
      hasPermission,
      can,
      canCreate,
      canEdit,
      canDelete,
      getModuleActions,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedLoading, isSuperAdmin, moduleActionsMap]
  );

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
