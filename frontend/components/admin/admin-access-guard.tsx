"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { findNavMatch } from "@/lib/admin-nav";
import { usePermissions } from "@/lib/admin/permissions-context";

/** Blocks direct-URL access to a module the current role can't see in the
 * nav either — without this, hiding a link from the sidebar would still
 * leave the page itself reachable by typing/bookmarking its URL.
 * Pages with no nav entry (e.g. a detail sub-route not itself listed)
 * inherit their parent module's access via findNavMatch's prefix match. */
export function AdminAccessGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, canAccessModule } = usePermissions();

  const match = findNavMatch(pathname);
  const allowed = loading || !match || canAccessModule(match.item.moduleKey);

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/admin");
    }
  }, [loading, allowed, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-32">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
