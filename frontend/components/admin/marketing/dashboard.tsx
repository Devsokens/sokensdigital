"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { getMarketingDashboard } from "@/lib/api/marketing";
import type { MarketingDashboard } from "@/lib/api/types";

const LEAD_STATUS_LABELS: Record<string, string> = {
  NOUVEAU: "Nouveau",
  QUALIFIE: "Qualifié",
  PROPOSITION_EN_COURS: "Proposition en cours",
  PERDU: "Perdu",
  CONVERTI: "Converti",
};

const LEAD_SOURCE_LABELS: Record<string, string> = {
  FORMULAIRE_CONTACT: "Formulaire de contact",
  FORMULAIRE_DEVIS: "Formulaire de devis",
  APPEL_ENTRANT: "Appel entrant",
  SITE_WEB: "Site web",
  EVENEMENT: "Événement",
};

const SOCIAL_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmé",
  PUBLISHED: "Publié",
  FAILED: "Échec",
  CANCELLED: "Annulé",
};

const PLATFORM_SHORT_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  TWITTER: "X",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
};

const ACTIVE_STATUS_COLORS: Record<string, string> = {
  NOUVEAU: "#6366f1",
  QUALIFIE: "#06b6d4",
  PROPOSITION_EN_COURS: "#f59e0b",
};

const PALETTE = ["#06b6d4", "#6366f1", "#f59e0b", "#f43f5e", "#8b5cf6", "#10b981"];

function formatCurrency(value: string) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value));
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

/** Real week-over-week comparison from the 30-day series — no fabricated
 * trend. Returns null when there isn't enough history yet to compare. */
function computeWeeklyTrend(points: { count: number }[]) {
  if (points.length < 14) return null;
  const last7 = points.slice(-7).reduce((a, p) => a + p.count, 0);
  const prev7 = points.slice(-14, -7).reduce((a, p) => a + p.count, 0);
  if (prev7 === 0) return last7 > 0 ? { percent: null, positive: true } : null;
  return { percent: Math.round(((last7 - prev7) / prev7) * 100), positive: last7 >= prev7 };
}

function KpiCard({
  href, eyebrow, children,
}: { href: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col rounded-3xl border border-neutral-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-200/60"
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-neutral-500">{eyebrow}</p>
        <ArrowRight className="size-3.5 -translate-x-1 text-neutral-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:text-neutral-400 group-hover:opacity-100" />
      </div>
      {children}
    </Link>
  );
}

function TrendPill({ percent, positive }: { percent: number | null; positive: boolean }) {
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`flex size-5 items-center justify-center rounded-full ${positive ? "bg-emerald-500" : "bg-rose-500"} text-white`}>
        <Icon className="size-3" />
      </span>
      <span className="text-xs text-neutral-500">
        {percent === null ? "Nouveau" : `${percent > 0 ? "+" : ""}${percent}%`} cette semaine
      </span>
    </span>
  );
}

function SegmentedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <p className="text-xs text-neutral-400">Aucun lead actif dans le pipeline.</p>;
  }
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-100">
        {segments.map((s) =>
          s.value > 0 ? (
            <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          ) : null
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {segments.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5 text-[0.7rem] text-neutral-500">
            <span className="size-1.5 rounded-full" style={{ background: s.color }} />
            {s.label} <span className="font-medium text-neutral-700">{s.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ConversionGauge({ rate }: { rate: number }) {
  const clamped = Math.min(100, Math.max(0, rate));
  return (
    <div className="relative mx-auto size-24">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={[{ value: clamped }]}
          startAngle={90}
          endAngle={-270}
          innerRadius="72%"
          outerRadius="100%"
          barSize={9}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar dataKey="value" cornerRadius={9} fill="#06b6d4" background={{ fill: "#f0f9ff" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold text-neutral-900">{rate}%</span>
      </div>
    </div>
  );
}

function MiniBarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ResponsiveContainer width="100%" height={72}>
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#a3a3a3" }} axisLine={false} tickLine={false} interval={0} />
        <Bar dataKey="value" radius={[5, 5, 5, 5]} maxBarSize={22}>
          {data.map((entry) => (
            <Cell key={entry.label} fill={entry.value === max && max > 0 ? "#06b6d4" : "#dff5fa"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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

function DonutChart({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return <p className="flex h-56 items-center justify-center text-sm text-neutral-400">Aucune donnée.</p>;
  }
  const chartData = entries.map(([key, value]) => ({ name: labels?.[key] ?? key, value }));

  return (
    <ResponsiveContainer width="100%" height={230}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          cornerRadius={6}
          strokeWidth={0}
        >
          {chartData.map((_, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
          formatter={(value) => [value, "Total"]}
        />
        <Legend
          layout="vertical"
          verticalAlign="middle"
          align="right"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#525252" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MarketingDashboardView() {
  const [data, setData] = useState<MarketingDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMarketingDashboard()
      .then(setData)
      .catch(() => setError("Impossible de charger le dashboard."));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const trendData = data.leads_over_time.map((point) => ({ ...point, label: formatShortDate(point.date) }));
  const publishedTotal = Object.values(data.published_social_posts_by_platform).reduce((a, b) => a + b, 0);
  const weeklyTrend = computeWeeklyTrend(data.leads_over_time);
  const convertedLeads = data.leads_by_status["CONVERTI"] ?? 0;
  const platformBars = Object.entries(data.published_social_posts_by_platform).map(([key, value]) => ({
    label: PLATFORM_SHORT_LABELS[key] ?? key,
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 items-start">
        <KpiCard href="/admin/marketing/leads" eyebrow="Pipeline pondéré">
          <p className="text-4xl font-semibold tracking-tight text-neutral-900">
            {formatCurrency(data.weighted_pipeline)} <span className="text-xl text-neutral-400">€</span>
          </p>
          <p className="mt-1 mb-4 text-xs text-neutral-400">Valeur estimée × score de qualification</p>
          <SegmentedBar
            segments={Object.keys(ACTIVE_STATUS_COLORS).map((key) => ({
              label: LEAD_STATUS_LABELS[key],
              value: data.leads_by_status[key] ?? 0,
              color: ACTIVE_STATUS_COLORS[key],
            }))}
          />
        </KpiCard>

        <KpiCard href="/admin/marketing/leads" eyebrow="Leads au total">
          <p className="text-5xl font-semibold tracking-tight text-neutral-900">{data.total_leads}</p>
          <div className="mt-3">
            {weeklyTrend ? (
              <TrendPill percent={weeklyTrend.percent} positive={weeklyTrend.positive} />
            ) : (
              <span className="text-xs text-neutral-400">Historique insuffisant pour une tendance</span>
            )}
          </div>
        </KpiCard>

        <KpiCard href="/admin/marketing/leads" eyebrow="Taux de conversion">
          <div className="flex items-center gap-4">
            <ConversionGauge rate={Number(data.conversion_rate)} />
            <div>
              <p className="text-2xl font-semibold text-neutral-900">{convertedLeads}</p>
              <p className="text-xs text-neutral-400">convertis sur {data.total_leads} leads</p>
            </div>
          </div>
        </KpiCard>

        <KpiCard href="/admin/marketing/plan-editorial" eyebrow="Publications publiées">
          <p className="mb-1 text-4xl font-semibold tracking-tight text-neutral-900">{publishedTotal}</p>
          <p className="mb-2 text-xs text-neutral-400">Toutes plateformes confondues</p>
          {platformBars.length > 0 ? (
            <MiniBarChart data={platformBars} />
          ) : (
            <p className="flex h-[72px] items-center gap-1.5 text-xs text-neutral-400">
              <Sparkles className="size-3.5" /> Rien de publié pour l&apos;instant
            </p>
          )}
        </KpiCard>
      </div>

      <ChartCard title="Nouveaux leads" subtitle="30 derniers jours">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis
              dataKey="label" tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false}
              interval={4}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
              labelFormatter={(label) => `Le ${label}`}
              formatter={(value) => [value, "Nouveaux leads"]}
            />
            <Area type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2.5} fill="url(#leadsGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Leads par statut" subtitle="Répartition du pipeline">
          <DonutChart data={data.leads_by_status} labels={LEAD_STATUS_LABELS} />
        </ChartCard>
        <ChartCard title="Leads par source" subtitle="D'où viennent les prospects">
          <DonutChart data={data.leads_by_source} labels={LEAD_SOURCE_LABELS} />
        </ChartCard>
        <ChartCard title="Publications par statut" subtitle="Plan éditorial">
          <DonutChart data={data.social_posts_by_status} labels={SOCIAL_STATUS_LABELS} />
        </ChartCard>
        <ChartCard title="Publications publiées par plateforme">
          <DonutChart data={data.published_social_posts_by_platform} />
        </ChartCard>
      </div>
    </div>
  );
}
