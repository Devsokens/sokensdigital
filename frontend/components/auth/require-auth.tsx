"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center py-32">
      {children}
    </div>
  );
}

/** Gate for pages that require a signed-in AND provisioned account.
 * There's no self-registration (see docs/backend-specifications.md §3.1) —
 * a signed-in Firebase user with no /profiles/{uid} doc means an admin
 * hasn't provisioned them yet, which is a distinct state from "logged out". */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/connexion");
    }
  }, [loading, user, router]);

  if (loading || (!loading && !user)) {
    return (
      <CenteredState>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </CenteredState>
    );
  }

  if (!profile) {
    return (
      <CenteredState>
        <p className="max-w-sm text-center text-sm text-muted-foreground">
          Votre compte n&apos;a pas encore été configuré par un
          administrateur. Contactez votre Super-Admin ou le service RH.
        </p>
      </CenteredState>
    );
  }

  return <>{children}</>;
}
