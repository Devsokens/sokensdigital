"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getGlobalDashboard } from "@/lib/api/core";
import { GlobalDashboardView } from "@/components/admin/global-dashboard-view";
import type { GlobalDashboard } from "@/lib/api/types";

/** Cross-department rich overview dashboard with multi-indicators, sparklines,
 * dual-ring goal gauge, comparative bar chart, and category donut distribution. */
export default function AdminDashboardPage() {
  const [data, setData] = useState<GlobalDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGlobalDashboard()
      .then(setData)
      .catch(() => setError("Impossible de charger le tableau de bord global."));
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-sm text-destructive">
        <p className="font-semibold">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-3 rounded-lg bg-destructive px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-neutral-400" />
        <p className="text-sm text-neutral-500">Chargement des indicateurs globaux…</p>
      </div>
    );
  }

  return <GlobalDashboardView data={data} />;
}
