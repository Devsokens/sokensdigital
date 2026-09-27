"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2 } from "lucide-react";
import { getProjectStats, type ProjectMemberStats } from "@/lib/api/projects";

// Même palette que rh-dashboard.tsx, pour rester visuellement cohérent avec
// le reste de l'admin.
const PALETTE = { assigned: "#6366f1", done: "#10b981", hours: "#06b6d4" };

function memberLabel(m: ProjectMemberStats["user"]) {
  const name = `${m.first_name} ${m.last_name}`.trim();
  return name || "—";
}

/** Qui travaille et qui ne travaille pas sur ce projet : tâches
 * assignées/terminées et heures loguées par membre — pas de graphes
 * existants sur ce module avant, Recharts est déjà la librairie du reste de
 * l'admin (rh-dashboard.tsx, marketing/dashboard.tsx). */
export function ProjectStatsTab({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<ProjectMemberStats[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProjectStats(projectId)
      .then((data) => setMembers(data.members))
      .catch(() => setError("Impossible de charger les statistiques du projet."));
  }, [projectId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!members) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }
  if (members.length === 0) {
    return <p className="text-sm text-neutral-400">Aucun membre sur ce projet pour l&apos;instant.</p>;
  }

  const tasksData = members.map((m) => ({
    name: memberLabel(m.user),
    assignées: m.tasks_assigned,
    terminées: m.tasks_done,
  }));
  const hoursData = members.map((m) => ({ name: memberLabel(m.user), heures: m.hours_logged }));
  const inactive = members.filter((m) => m.tasks_assigned === 0 && m.hours_logged === 0);

  return (
    <div className="space-y-5">
      {inactive.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <strong className="font-semibold">Sans activité enregistrée :</strong>{" "}
          {inactive.map((m) => memberLabel(m.user)).join(", ")}.
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">Tâches par membre</h3>
        <ResponsiveContainer width="100%" height={Math.max(220, members.length * 44)}>
          <BarChart data={tasksData} layout="vertical" margin={{ left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#a3a3a3" }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#525252" }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="assignées" fill={PALETTE.assigned} radius={[0, 6, 6, 0]} />
            <Bar dataKey="terminées" fill={PALETTE.done} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-neutral-900">Heures loguées par membre</h3>
        <ResponsiveContainer width="100%" height={Math.max(220, members.length * 44)}>
          <BarChart data={hoursData} layout="vertical" margin={{ left: 12 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#a3a3a3" }} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: "#525252" }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }} formatter={(v) => [`${v} h`, "Heures"]} />
            <Bar dataKey="heures" fill={PALETTE.hours} radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
