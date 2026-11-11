"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { useIsGerant } from "@/lib/admin/use-is-gerant";
import { profileRoles } from "@/lib/firebase/types";

/** Interface Décaissements : Directeur financier, Comptable (exécution),
 * Super-Admin et gérant désigné. Simple confort d'affichage — l'API borne
 * déjà ce que chacun voit et peut valider. */
export function DecaissementsGuard({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const isGerant = useIsGerant();
  const roles = profileRoles(profile);
  const allowed = isGerant || roles.some((r) => ["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE"].includes(r));
  if (!allowed) {
    return <p className="py-16 text-center text-sm text-neutral-500">Cette interface est réservée au Directeur financier, au Comptable et au Gérant.</p>;
  }
  return <>{children}</>;
}
