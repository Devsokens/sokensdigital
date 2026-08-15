"use client";

import { useEffect, useState } from "react";
import { DepartmentRail } from "@/components/admin/department-rail";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "admin-sidebar-collapsed";

/** Owns the collapse state for the secondary (department detail) sidebar —
 * both the sidebar's own width and the main content's left padding need to
 * agree on it, so it's lifted here rather than duplicated. Persisted to
 * localStorage so the choice survives a reload; read only after mount to
 * avoid a server/client markup mismatch. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed, hydrated]);

  return (
    <div className="flex min-h-screen w-full print:block">
      <div className="print:hidden">
        <DepartmentRail />
        <AdminSidebar collapsed={collapsed} />
      </div>

      <div
        className={cn(
          "flex flex-1 flex-col transition-[padding] duration-200 print:pl-0",
          collapsed ? "lg:pl-20" : "lg:pl-[336px]"
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
