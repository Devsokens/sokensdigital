"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Loader2, XCircle } from "lucide-react";
import { getTeamTimesheet, setTeamTimesheetDayStatus } from "@/lib/api/projects";
import type { TeamTimesheetDayStatus, TeamTimesheetMember, TeamTimesheetResponse, TeamTimesheetWeekStatus } from "@/lib/api/types";

const WEEK_STATUS_LABELS: Record<TeamTimesheetWeekStatus, string> = {
  APPROVED: "Approuvé",
  PARTIAL: "Partiel",
  REJECTED: "Rejeté",
};

const WEEK_STATUS_COLORS: Record<TeamTimesheetWeekStatus, string> = {
  APPROVED: "bg-emerald-100 text-emerald-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  REJECTED: "bg-rose-100 text-rose-600",
};

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatHours(value: number) {
  if (!value) return "–";
  const totalMinutes = Math.round(value * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function mondayOf(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dayHeader(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return {
    weekday: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
    date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
  };
}

function DayStatusIcon({ status }: { status: TeamTimesheetDayStatus }) {
  if (status === "VALIDE") return <CheckCircle2 className="size-4 fill-emerald-100 text-emerald-600" />;
  if (status === "REJETE") return <XCircle className="size-4 fill-rose-100 text-rose-600" />;
  if (status === "SOUMIS") return <Circle className="size-4 text-neutral-300" />;
  return <span className="text-neutral-300">–</span>;
}

export function TeamTimesheet() {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState<TeamTimesheetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [memberFilter, setMemberFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load(start: Date) {
    try {
      const result = await getTeamTimesheet(isoDate(start));
      setData(result);
    } catch {
      setError("Impossible de charger la feuille de temps de l'équipe.");
    }
  }

  useEffect(() => {
    setData(null);
    load(weekStart);
  }, [weekStart]);

  async function handleApproveDay(member: TeamTimesheetMember, day: string, next: "VALIDE" | "REJETE") {
    const key = `${member.user.id}-${day}`;
    setBusyKey(key);
    try {
      await setTeamTimesheetDayStatus(member.user.id, day, next);
      await load(weekStart);
    } catch {
      setError("Impossible de mettre à jour cette journée.");
    } finally {
      setBusyKey(null);
    }
  }

  function toggleExpanded(userId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  const visibleMembers = useMemo(() => {
    let members = data?.members ?? [];
    if (memberFilter !== "all") members = members.filter((m) => m.user.id === memberFilter);
    if (statusFilter !== "all") members = members.filter((m) => m.week_status === statusFilter);
    return members;
  }, [data, memberFilter, statusFilter]);

  const isCurrentWeek = data ? isoDate(weekStart) === isoDate(mondayOf(new Date())) : true;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Feuille de temps de l&apos;équipe</h1>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-neutral-400">Membres :</span>
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700"
            >
              <option value="all">Tous</option>
              {(data?.members ?? []).map((m) => (
                <option key={m.user.id} value={m.user.id}>{m.user.first_name} {m.user.last_name}</option>
              ))}
            </select>
            <span className="text-neutral-400">Statut :</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-700"
            >
              <option value="all">Tous</option>
              <option value="APPROVED">Approuvé</option>
              <option value="PARTIAL">Partiel</option>
              <option value="REJECTED">Rejeté</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-neutral-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })}
              aria-label="Semaine précédente"
              className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeekStart((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })}
              aria-label="Semaine suivante"
              className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setWeekStart(mondayOf(new Date()))}
            disabled={isCurrentWeek}
            className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
          >
            Semaine actuelle
          </button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

      {!data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="w-64 px-4 py-3 text-left text-xs font-medium text-neutral-400">Cette semaine</th>
                {data.days.map((iso) => {
                  const h = dayHeader(iso);
                  return (
                    <th key={iso} className="px-2 py-3 text-center text-xs font-medium text-neutral-400">
                      <div className="capitalize text-neutral-600">{h.weekday}</div>
                      <div className="text-[10px] uppercase text-neutral-400">{h.date}</div>
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((member) => {
                const isOpen = expanded.has(member.user.id);
                return (
                  <MemberRows
                    key={member.user.id}
                    member={member}
                    days={data.days}
                    isOpen={isOpen}
                    onToggle={() => toggleExpanded(member.user.id)}
                    onApprove={handleApproveDay}
                    busyKey={busyKey}
                  />
                );
              })}
              {visibleMembers.length === 0 && (
                <tr>
                  <td colSpan={data.days.length + 2} className="px-4 py-10 text-center text-sm text-neutral-400">
                    Aucune donnée pour cette semaine.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MemberRows({
  member, days, isOpen, onToggle, onApprove, busyKey,
}: {
  member: TeamTimesheetMember;
  days: string[];
  isOpen: boolean;
  onToggle: () => void;
  onApprove: (member: TeamTimesheetMember, day: string, next: "VALIDE" | "REJETE") => void;
  busyKey: string | null;
}) {
  return (
    <>
      <tr className="border-b border-neutral-50 bg-neutral-50/60">
        <td className="px-4 py-3">
          <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left">
            {isOpen ? <ChevronUp className="size-3.5 text-neutral-400" /> : <ChevronDown className="size-3.5 text-neutral-400" />}
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(member.user.first_name, member.user.last_name)}
            </span>
            <span className="font-medium text-neutral-900">{member.user.first_name} {member.user.last_name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${WEEK_STATUS_COLORS[member.week_status]}`}>
              {WEEK_STATUS_LABELS[member.week_status]}
            </span>
          </button>
        </td>
        {days.map((iso) => {
          const dayStatus = member.daily_status[iso];
          const key = `${member.user.id}-${iso}`;
          const canApprove = dayStatus === "SOUMIS";
          return (
            <td key={iso} className="group relative px-2 py-3 text-center">
              <button
                type="button"
                disabled={!canApprove || busyKey === key}
                onClick={() => canApprove && onApprove(member, iso, "VALIDE")}
                title={canApprove ? "Approuver ce jour" : undefined}
                className="mx-auto flex items-center justify-center disabled:cursor-default"
              >
                {busyKey === key ? <Loader2 className="size-4 animate-spin text-neutral-400" /> : <DayStatusIcon status={dayStatus} />}
              </button>
            </td>
          );
        })}
        <td className="px-4 py-3 text-right font-medium text-neutral-900">{formatHours(member.week_total)}</td>
      </tr>

      {isOpen && member.tasks.map((task, idx) => (
        <tr key={idx} className="border-b border-neutral-50">
          <td className="px-4 py-2.5 pl-11">
            <p className="text-sm text-neutral-800">{task.task_title ?? "Heures diverses"}</p>
            <p className="text-xs text-neutral-400">{task.project_name}</p>
          </td>
          {days.map((iso) => (
            <td key={iso} className="px-2 py-2.5 text-center text-sm text-neutral-500">
              {formatHours(task.daily_hours[iso])}
            </td>
          ))}
          <td className="px-4 py-2.5 text-right text-sm text-neutral-600">{formatHours(task.total)}</td>
        </tr>
      ))}
    </>
  );
}
