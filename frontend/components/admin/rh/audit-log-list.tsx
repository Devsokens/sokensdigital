"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
      <p className="mb-6 text-sm text-neutral-500">
        Journal immuable — alimenté automatiquement à chaque suppression d&apos;un enregistrement. Lecture seule.
      </p>

      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Auteur</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Ressource</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 whitespace-nowrap text-neutral-500">
                  {new Date(log.created_at).toLocaleString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-neutral-900">
                  {log.user ? `${log.user.first_name} ${log.user.last_name}` : "Système"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {log.entity_type} <span className="text-neutral-300">#{log.entity_id.slice(0, 8)}</span>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-neutral-400">
                  Aucune entrée pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
