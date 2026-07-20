"use client";

import { useAuth } from "@/lib/auth/auth-context";
import type { AppRole } from "@/lib/firebase/types";

/** UI-level gate — the backend enforces the real authorization on every
 * endpoint regardless; this only avoids showing a screen (and letting
 * requests fail one by one) to someone who can't use it anyway. */
export function RequireRole({ roles, children }: { roles: AppRole[]; children: React.ReactNode }) {
  const { profile } = useAuth();

  if (!profile || !roles.includes(profile.role)) {
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
