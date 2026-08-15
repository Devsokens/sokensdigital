"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarClock, Loader2, Search, Trash2, Users } from "lucide-react";
import { listAuditLogs } from "@/lib/api/hr";
import type { AuditLogEntry } from "@/lib/api/types";
import { inputClass } from "@/components/admin/form-styles";

/** deleted_data (see backend LoggedModel.delete()) has a different shape
 * per model — this tries the field names most likely to be human-readable,
 * so the log reads "Technique" instead of a bare UUID when it can. */
function readableLabel(entry: AuditLogEntry): string | null {
  const data = entry.details?.deleted_data as Record<string, unknown> | undefined;
  if (!data) return null;
  if (typeof data.name === "string") return data.name;
  if (typeof data.title === "string") return data.title;
  if (typeof data.first_name === "string" || typeof data.last_name === "string") {
    return `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || null;
  }
  if (typeof data.email === "string") return data.email;
  return null;
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

export function AuditLogList() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  // Set once on mount (never during render itself — Date.now() is impure
  // and the lint rule forbids calling it directly in the render body).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  useEffect(() => {
    listAuditLogs()
      .then((data) => setLogs(data.results))
      .catch(() => setError("Impossible de charger le journal d'audit."));
  }, []);

  const entityTypes = useMemo(
    () => Array.from(new Set((logs ?? []).map((l) => l.entity_type))).sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    if (!logs) return [];
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (entityFilter && l.entity_type !== entityFilter) return false;
      if (!q) return true;
      const author = l.user ? `${l.user.first_name} ${l.user.last_name}` : "système";
      const label = readableLabel(l) ?? "";
      return `${author} ${l.entity_type} ${l.entity_id} ${label}`.toLowerCase().includes(q);
    });
  }, [logs, search, entityFilter]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!logs) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const thisWeekCount = now === null
    ? 0
    : logs.filter((l) => now - new Date(l.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000).length;
  const uniqueUsers = new Set(logs.map((l) => l.user?.id ?? "system")).size;
  const topEntity = Object.entries(
    logs.reduce<Record<string, number>>((acc, l) => {
      acc[l.entity_type] = (acc[l.entity_type] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Audit Log</h1>
      <p data-tour="module-rh-audit" className="mb-6 text-sm text-neutral-500">
        Journal immuable — alimenté automatiquement à chaque suppression d&apos;un enregistrement. Lecture seule.
      </p>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Suppressions au total" value={String(logs.length)} icon={Trash2} />
        <StatCard label="Cette semaine" value={String(thisWeekCount)} icon={CalendarClock} />
        <StatCard label="Utilisateurs impliqués" value={String(uniqueUsers)} icon={Users} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex max-w-[320px] flex-1 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <Search className="size-3.5 shrink-0 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (auteur, type, id)"
            className="w-full min-w-0 border-0 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className={`${inputClass} w-auto py-2`}
        >
          <option value="">Tous les types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        {topEntity && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-neutral-400">
            <Activity className="size-3.5" /> Le plus fréquent : {topEntity[0]} ({topEntity[1]})
          </span>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-2 shadow-sm">
        {filtered.map((log, index) => {
          const label = readableLabel(log);
          return (
            <div key={log.id} className="relative flex gap-4 py-4">
              {index < filtered.length - 1 && (
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
                  a supprimé {label ? (
                    <>
                      <strong className="font-semibold">{label}</strong>{" "}
                      <span className="text-neutral-400">({log.entity_type})</span>
                    </>
                  ) : (
                    <strong className="font-semibold">un {log.entity_type}</strong>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-2 font-mono text-xs text-neutral-400">
                  #{log.entity_id.slice(0, 8)}
                  {log.ip_address && <span>· {log.ip_address}</span>}
                </p>
              </div>
              <span className="h-fit shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
                DELETE
              </span>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="py-8 text-center text-neutral-400">
            {logs.length === 0 ? "Aucune entrée pour l'instant." : "Aucun résultat."}
          </p>
        )}
      </div>
    </div>
  );
}
