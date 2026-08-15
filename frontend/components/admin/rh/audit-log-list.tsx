"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { listAuditLogs } from "@/lib/api/hr";
import type { AuditLogEntry } from "@/lib/api/types";

export function AuditLogList() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAuditLogs()
      .then((data) => setLogs(data.results))
      .catch(() => setError("Impossible de charger le journal d'audit."));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!logs) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Audit Log</h1>
      <p data-tour="module-rh-audit" className="mb-6 text-sm text-neutral-500">
        Journal immuable — alimenté automatiquement à chaque suppression d&apos;un enregistrement. Lecture seule.
      </p>

      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-2 shadow-sm">
        {logs.map((log, index) => (
          <div key={log.id} className="relative flex gap-4 py-4">
            {index < logs.length - 1 && (
              <span className="absolute left-[15px] top-11 bottom-0 w-px bg-neutral-100" />
            )}
            <span className="w-24 shrink-0 pt-1.5 font-mono text-xs text-neutral-400">
              {new Date(log.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}{" "}
              {new Date(log.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm text-neutral-900">
                <strong className="font-semibold">
                  {log.user ? `${log.user.first_name} ${log.user.last_name}` : "Système"}
                </strong>{" "}
                a supprimé un <strong className="font-semibold">{log.entity_type}</strong>
              </p>
              <p className="mt-0.5 font-mono text-xs text-neutral-400">#{log.entity_id.slice(0, 8)}</p>
            </div>
            <span className="h-fit shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
              DELETE
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="py-8 text-center text-neutral-400">Aucune entrée pour l&apos;instant.</p>
        )}
      </div>
    </div>
  );
}
