"use client";

import { useEffect, useState } from "react";
import { getMe } from "@/lib/api/me";
import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles } from "@/lib/firebase/types";

/** Peut statuer au palier « Gérant » : le gérant désigné (User.is_gerant,
 * Administration > Utilisateurs), ou un Super-Admin. Simple confort
 * d'affichage — le backend (core.permissions.is_gerant) reste la seule
 * vraie barrière. */
export function useIsGerant(): boolean {
  const { profile } = useAuth();
  const isSuperAdmin = profileRoles(profile).includes("SUPER_ADMIN");
  const [designated, setDesignated] = useState(false);

  useEffect(() => {
    if (!profile || isSuperAdmin) return;
    let cancelled = false;
    getMe()
      .then((me) => { if (!cancelled) setDesignated(Boolean(me.is_gerant)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [profile, isSuperAdmin]);

  return isSuperAdmin || designated;
}
