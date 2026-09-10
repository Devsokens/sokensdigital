"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { listRoles } from "@/lib/api/hr";
import { DJANGO_ROLE_TO_APP_ROLE, profileRoles } from "@/lib/firebase/types";

interface PermissionsContextValue {
  loading: boolean;
  isSuperAdmin: boolean;
  canAccessModule: (moduleKey: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextValue>({
  loading: true,
  isSuperAdmin: false,
  canAccessModule: () => false,
});

/** Which modules (see lib/admin/permission-modules.ts's PERMISSION_MODULES
 * keys) the signed-in user's role grants access to — drives what the nav
 * shows and which routes are reachable (see AdminAccessGuard). Backed by
 * core.Role.permissions (see backend/core/constants.py), fetched once per
 * session (not once per consumer — department-rail, admin-sidebar,
 * mobile-bottom-nav and the route guard all read the same value) and
 * matched to the Firestore profile's role.
 *
 * Super-Admin always has access to everything regardless of what's stored
 * — editing that role's permissions through the UI must never be able to
 * lock the only admin account out of its own app. */
export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [permittedModules, setPermittedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const myRoles = profileRoles(profile);
  const isSuperAdmin = myRoles.includes("SUPER_ADMIN");
  // Only Super-Admin's own app-lockout aside, only a non-Super-Admin
  // profile ever needs a roles fetch — no profile yet (still resolving
  // auth) and Super-Admin both resolve to "not loading" without ever
  // touching the network.
  const needsFetch = Boolean(profile) && !isSuperAdmin;
  const myRolesKey = myRoles.join(",");

  useEffect(() => {
    if (!needsFetch) return;
    let cancelled = false;
    listRoles()
      .then((res) => {
        if (cancelled) return;
        // Cumul de rôles (décision du 10/09/2026) : union des permissions de
        // chaque rôle de la personne, pas seulement du premier trouvé.
        const permitted = new Set<string>();
        for (const row of res.results) {
          if (myRoles.includes(DJANGO_ROLE_TO_APP_ROLE[row.name])) {
            for (const key of Object.keys(row.permissions ?? {})) permitted.add(key);
          }
        }
        setPermittedModules(permitted);
      })
      .catch(() => {
        if (!cancelled) setPermittedModules(new Set());
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
    return permittedModules.has(moduleKey);
  }

  return (
    <PermissionsContext.Provider value={{ loading: resolvedLoading, isSuperAdmin, canAccessModule }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}
