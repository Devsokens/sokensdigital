"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles, type AppRole } from "@/lib/firebase/types";

/** UI-level gate — the backend enforces the real authorization on every
 * endpoint regardless; this only avoids showing a screen (and letting
 * requests fail one by one) to someone who can't use it anyway.
 *
 * A user can cumulate several roles (décision du 10/09/2026) — access is
 * granted if ANY of their roles is in the allow-list. */
export function RequireRole({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { profile } = useAuth();
  const mine = profileRoles(profile);

  if (!profile || !mine.some((r) => roles.includes(r))) {
    return (
      <div className="flex justify-center py-16">
        <p className="text-sm text-neutral-400">
          Cette page est réservée à : {roles.join(", ")}.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
