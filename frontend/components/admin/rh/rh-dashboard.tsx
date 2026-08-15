"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Loader2, UserCheck, UserPlus, Users } from "lucide-react";
import { listEmployees, listDepartments } from "@/lib/api/hr";
import type { EmployeeProfile, Department } from "@/lib/api/types";
import { formatFcfa } from "@/lib/format-currency";

const CONTRACT_LABELS: Record<string, string> = {
  CDI: "CDI",
  CDD: "CDD",
  STAGE: "Stage",
  FREELANCE: "Freelance",
};

const PALETTE = ["#06b6d4", "#6366f1", "#f59e0b", "#f43f5e", "#8b5cf6", "#10b981"];

function StatCard({
  label, value, sublabel, icon: Icon, accent,
}: { label: string; value: string; sublabel?: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="absolute -top-8 -right-8 size-24 rounded-full opacity-[0.08]" style={{ background: accent }} />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-neutral-900">{value}</p>
          {sublabel && <p className="mt-1 text-[0.7rem] text-neutral-400">{sublabel}</p>}
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${accent}1a`, color: accent }}>
          <Icon className="size-4.5" />
        </span>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {subtitle && <p className="text-xs text-neutral-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function DonutChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return <p className="flex h-56 items-center justify-center text-sm text-neutral-400">Aucune donnée.</p>;
  }
  const chartData = entries.map(([name, value]) => ({ name, value }));

  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie
          data={chartData} dataKey="value" nameKey="name"
          innerRadius={55} outerRadius={85} paddingAngle={3} cornerRadius={6} strokeWidth={0}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }} formatter={(value) => [value, "Total"]} />
        <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: "#525252" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Number of hires per month over the last 12 months. */
function hiringTrend(employees: EmployeeProfile[]) {
  const months: { key: string; label: string; count: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("fr-FR", { month: "short" }),
      count: 0,
    });
  }
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const e of employees) {
    if (!e.hire_date) continue;
    const d = new Date(e.hire_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.count += 1;
  }
  return months;
}

export function RhDashboard() {
  const [employees, setEmployees] = useState<EmployeeProfile[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listEmployees(), listDepartments()])
      .then(([empRes, deptRes]) => {
        setEmployees(empRes.results);
        setDepartments(deptRes.results);
      })
      .catch(() => setError("Impossible de charger le dashboard."));
  }, []);

  const contractBreakdown = useMemo(() => {
    if (!employees) return {};
    const counts: Record<string, number> = {};
    for (const e of employees) {
      const active = e.contracts.find((c) => c.status === "ACTIF");
      if (!active) continue;
      const label = CONTRACT_LABELS[active.contract_type] ?? active.contract_type;
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return counts;
  }, [employees]);

  const departmentBreakdown = useMemo(() => {
    if (!employees) return {};
    const counts: Record<string, number> = {};
    for (const e of employees) {
      const name = e.user.department_name || "Sans département";
      counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [employees]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!employees) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const activeCount = employees.filter((e) => e.status === "ACTIF").length;
  const thisMonth = new Date();
  const newThisMonth = employees.filter((e) => {
    if (!e.hire_date) return false;
    const d = new Date(e.hire_date);
    return d.getFullYear() === thisMonth.getFullYear() && d.getMonth() === thisMonth.getMonth();
  }).length;
  const totalPayroll = employees
    .filter((e) => e.status === "ACTIF" && e.gross_monthly_salary)
    .reduce((sum, e) => sum + Number(e.gross_monthly_salary), 0);
  const trendData = hiringTrend(employees);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Tableau de bord RH</h1>
        <p className="mt-1.5 text-sm text-neutral-500">Vue d&apos;ensemble des effectifs et de la masse salariale.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Employés" value={String(employees.length)} sublabel={`${activeCount} actifs`} icon={Users} accent="#06b6d4" />
        <StatCard label="Nouvelles arrivées" value={String(newThisMonth)} sublabel="Ce mois-ci" icon={UserPlus} accent="#10b981" />
        <StatCard label="Départements" value={String(departments.length)} sublabel="Unités organisationnelles" icon={Building2} accent="#6366f1" />
        <StatCard label="Masse salariale" value={formatFcfa(totalPayroll)} sublabel="Employés actifs, brut mensuel" icon={UserCheck} accent="#f59e0b" />
      </div>

      <ChartCard title="Embauches" subtitle="12 derniers mois">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="hiresGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }} formatter={(value) => [value, "Embauches"]} />
            <Area type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2.5} fill="url(#hiresGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Employés par département">
          <DonutChart data={departmentBreakdown} />
        </ChartCard>
        <ChartCard title="Types de contrat">
          <DonutChart data={contractBreakdown} />
        </ChartCard>
      </div>
    </div>
  );
}
