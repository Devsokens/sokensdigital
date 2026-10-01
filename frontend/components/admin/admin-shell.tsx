"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DepartmentRail } from "@/components/admin/department-rail";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-sidebar-collapsed";

/** Routes where the department rail/sidebar hide entirely so the page takes
 * the full width — e.g. a project's detail page, dense enough on its own
 * (kanban + stats) to want the space back. Prefix match, like
 * findNavMatch/filterSectionsByAccess in lib/admin-nav.ts. */
const FULL_WIDTH_ROUTE_PREFIXES = [/^\/admin\/technique\/projets\/[^/]+$/];

function isFullWidthRoute(pathname: string) {
  return FULL_WIDTH_ROUTE_PREFIXES.some((pattern) => pattern.test(pathname));
}

/** Owns the collapse state for the secondary (department detail) sidebar —
 * both the sidebar's own width and the main content's left padding need to
 * agree on it, so it's lifted here rather than duplicated. Persisted to
 * localStorage so the choice survives a reload; read only after mount to
 * avoid a server/client markup mismatch. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const fullWidth = isFullWidthRoute(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  // `min-h-dvh` et non `min-h-screen` : `100vh` est figé à la hauteur du
  // viewport barre d'URL déployée, donc dès qu'elle se rétracte le contenu
  // s'arrête avant le bas de l'écran et laisse voir le fond sombre du body —
  // la bande noire sous la barre de navigation. `dvh` suit la hauteur
  // réellement visible.
  //
  // Le fond blanc est porté ici en plus du <main> pour que le shell couvre
  // toute la colonne, y compris le dépassement du rebond de défilement iOS,
  // où le body sombre affleurait également.
  return (
    <div className="flex min-h-dvh w-full bg-white print:block">
      {!fullWidth && (
        <div className="print:hidden">
          <DepartmentRail />
          <AdminSidebar collapsed={collapsed} />
        </div>
      )}

      <div
        className={cn(
          "flex flex-1 flex-col transition-[padding] duration-200 print:pl-0",
          !fullWidth && (collapsed ? "lg:pl-20" : "lg:pl-[336px]")
        )}
      >
        <div className="print:hidden">
          <AdminHeader onToggleSidebar={() => setCollapsed((v) => !v)} />
        </div>
        <main className="flex-1 bg-white px-6 py-8 pb-28 text-neutral-900 lg:px-10 lg:pb-8 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
