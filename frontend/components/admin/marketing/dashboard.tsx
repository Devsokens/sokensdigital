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
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { getMarketingDashboard } from "@/lib/api/marketing";
import type { MarketingDashboard, UserBrief } from "@/lib/api/types";

const LEAD_STATUS_LABELS: Record<string, string> = {
  NOUVEAU: "Nouveau",
  QUALIFIE: "Qualifié",
  PROPOSITION_EN_COURS: "Proposition en cours",
  PERDU: "Perdu",
  CONVERTI: "Converti",
};

const LEAD_STATUS_COLORS: Record<string, string> = {
  NOUVEAU: "#6366f1",
  QUALIFIE: "#06b6d4",
  PROPOSITION_EN_COURS: "#f59e0b",
  PERDU: "#e5e5e5",
  CONVERTI: "#10b981",
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

const PLATFORM_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  TWITTER: "X",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
};

const PLATFORM_BADGE_COLORS: Record<string, string> = {
  LINKEDIN: "#0a66c2",
  TWITTER: "#0f1419",
  FACEBOOK: "#1877f2",
  INSTAGRAM: "#d6249f",
  YOUTUBE: "#ff0000",
};

const PALETTE = ["#06b6d4", "#6366f1", "#f59e0b", "#f43f5e", "#8b5cf6", "#10b981"];

function formatCurrency(value: string) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value));
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

function formatLongDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(new Date(iso));
}

function initials(user: UserBrief) {
  return `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "?";
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

function BentoCard({
  href, className, children,
}: { href: string; className?: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col rounded-3xl border border-neutral-100 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-neutral-200/60 ${className ?? ""}`}
    >
      <ArrowRight className="absolute top-6 right-6 size-3.5 -translate-x-1 text-neutral-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:text-neutral-400 group-hover:opacity-100" />
      {children}
    </Link>
  );
}

function TrendPill({ percent, positive }: { percent: number | null; positive: boolean }) {
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`flex size-5 items-center justify-center rounded-full ${positive ? "bg-emerald-500" : "bg-rose-500"} text-white`}>
        <Icon className="size-3" />
      </span>
      <span className="text-xs text-neutral-500">
        {percent === null ? "Nouveau" : `${percent > 0 ? "+" : ""}${percent}%`} cette semaine
      </span>
    </span>
  );
}

function DualRing({ outer, inner }: { outer: number; inner: number }) {
  const data = [
    { name: "outer", value: Math.min(100, Math.max(0, outer)), fill: "#06b6d4" },
    { name: "inner", value: Math.min(100, Math.max(0, inner)), fill: "#8b5cf6" },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart
        data={data} startAngle={90} endAngle={-270}
        innerRadius="38%" outerRadius="100%" barSize={9} barGap={4}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="value" cornerRadius={9} background={{ fill: "#f5f5f5" }} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}

function ConversionGauge({ rate }: { rate: number }) {
  const clamped = Math.min(100, Math.max(0, rate));
  return (
    <div className="relative mx-auto size-24">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={[{ value: clamped }]} startAngle={90} endAngle={-270}
          innerRadius="72%" outerRadius="100%" barSize={9}
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

function AvatarStack({ users }: { users: UserBrief[] }) {
  return (
    <div className="flex -space-x-2.5">
      {users.slice(0, 4).map((user) => (
        <span
          key={user.id}
          className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-primary/10 text-xs font-semibold text-primary"
        >
          {initials(user)}
        </span>
      ))}
      {users.length > 4 && (
        <span className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-neutral-100 text-xs font-medium text-neutral-500">
          +{users.length - 4}
        </span>
      )}
    </div>
  );
}

function ProgressRows({ segments }: { segments: { label: string; value: number; total: number; color: string }[] }) {
  return (
    <div className="space-y-3">
      {segments.map((s) => {
        const percent = s.total > 0 ? Math.round((s.value / s.total) * 100) : 0;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-neutral-500">{s.label}</span>
              <span className="font-medium text-neutral-900">{percent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full" style={{ width: `${percent}%`, background: s.color }} />
            </div>
          </div>
        );
      })}
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
  const weeklyTrend = computeWeeklyTrend(data.leads_over_time);
  const leadsThisWeek = data.leads_over_time.slice(-7).reduce((a, p) => a + p.count, 0);
  const platformBars = Object.entries(data.published_social_posts_by_platform).map(([key, value]) => ({
    label: PLATFORM_LABELS[key] ?? key,
    value,
  }));
  const totalActiveLeads = ["NOUVEAU", "QUALIFIE", "PROPOSITION_EN_COURS"].reduce(
    (sum, key) => sum + (data.leads_by_status[key] ?? 0), 0,
  );
  const statusRows = Object.entries(data.leads_by_status)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      label: LEAD_STATUS_LABELS[key] ?? key,
      value,
      total: data.total_leads,
      color: LEAD_STATUS_COLORS[key] ?? "#06b6d4",
    }));
  const pipelinePercent = Number(data.active_pipeline_total_estimated) > 0
    ? Math.round((Number(data.weighted_pipeline) / Number(data.active_pipeline_total_estimated)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 items-start">
        {/* 1. Leads au total */}
        <BentoCard href="/admin/marketing/leads">
          <p className="mb-4 text-sm text-neutral-500">Leads au total<br /><span className="text-xs text-neutral-400">Toutes sources confondues</span></p>
          <p className="text-5xl font-semibold tracking-tight text-neutral-900">{data.total_leads}</p>
          <p className="mt-3 text-xs text-neutral-400">
            <span className="font-medium text-neutral-600">{totalActiveLeads}</span> actifs dans le pipeline ·{" "}
            <span className="font-medium text-neutral-600">{data.leads_by_status["CONVERTI"] ?? 0}</span> convertis
          </p>
        </BentoCard>

        {/* 2. Nouveaux leads cette semaine */}
        <BentoCard href="/admin/marketing/leads">
          <p className="mb-4 text-sm text-neutral-500">Nouveaux leads<br />7 derniers jours</p>
          <p className="text-5xl font-semibold tracking-tight text-neutral-900">{leadsThisWeek}</p>
          <div className="mt-3">
            {weeklyTrend ? (
              <TrendPill percent={weeklyTrend.percent} positive={weeklyTrend.positive} />
            ) : (
              <span className="text-xs text-neutral-400">Historique insuffisant</span>
            )}
          </div>
        </BentoCard>

        {/* 3. Prochaine publication programmée */}
        <BentoCard href="/admin/marketing/plan-editorial">
          {data.next_scheduled_post ? (
            <>
              <span
                className="mb-4 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ background: PLATFORM_BADGE_COLORS[data.next_scheduled_post.platform] ?? "#525252" }}
              >
                {PLATFORM_LABELS[data.next_scheduled_post.platform] ?? data.next_scheduled_post.platform}
              </span>
              <p className="text-xs text-neutral-400">Prochaine publication</p>
              <p className="mt-1 mb-4 text-lg leading-snug font-semibold text-neutral-900">
                {data.next_scheduled_post.title}
              </p>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <CalendarClock className="size-3.5" /> {formatLongDate(data.next_scheduled_post.scheduled_at)}
              </span>
            </>
          ) : (
            <EmptyState label="Plan éditorial" text="Aucune publication programmée" />
          )}
        </BentoCard>

        {/* 4. Conversion & Devis acceptés — dual ring */}
        <BentoCard href="/admin/marketing/devis">
          <div className="mb-4 flex gap-6">
            <div>
              <p className="text-2xl font-semibold text-neutral-900">{data.conversion_rate}%</p>
              <p className="text-xs text-neutral-500">Conversion leads</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-neutral-900">{data.quote_acceptance_rate}%</p>
              <p className="text-xs text-neutral-500">Devis acceptés</p>
            </div>
          </div>
          <div className="relative mx-auto size-28">
            <DualRing outer={Number(data.conversion_rate)} inner={Number(data.quote_acceptance_rate)} />
          </div>
          <div className="mt-3 flex justify-center gap-4 text-[0.7rem] text-neutral-500">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#06b6d4]" /> Conversion</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#8b5cf6]" /> Devis acceptés</span>
          </div>
        </BentoCard>

        {/* 5. Devis proche de l'expiration */}
        <BentoCard href="/admin/marketing/devis">
          {data.next_expiring_quote ? (
            <>
              <span className="mb-4 inline-flex w-fit items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600">
                Devis {data.next_expiring_quote.quote_number}
              </span>
              <p className="mb-4 text-lg leading-snug font-semibold text-neutral-900">
                {data.next_expiring_quote.client_name}
              </p>
              <div className="mt-auto flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <Clock className="size-3.5" /> Expire le {formatLongDate(data.next_expiring_quote.expiry_date)}
                </span>
                {data.next_expiring_quote.created_by && (
                  <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(data.next_expiring_quote.created_by)}
                  </span>
                )}
              </div>
            </>
          ) : (
            <EmptyState label="Devis" text="Aucun devis envoyé en attente d'expiration" />
          )}
        </BentoCard>

        {/* 6. Publications par plateforme */}
        <BentoCard href="/admin/marketing/plan-editorial">
          <p className="text-sm text-neutral-500">Publications publiées</p>
          <p className="mb-1 text-4xl font-semibold tracking-tight text-neutral-900">
            {platformBars.reduce((a, b) => a + b.value, 0)}
          </p>
          <p className="mb-2 text-xs text-neutral-400">Toutes plateformes confondues</p>
          {platformBars.length > 0 ? (
            <MiniBarChart data={platformBars} />
          ) : (
            <p className="flex h-[72px] items-center gap-1.5 text-xs text-neutral-400">
              <Sparkles className="size-3.5" /> Rien de publié pour l&apos;instant
            </p>
          )}
        </BentoCard>

        {/* 7. Équipe active */}
        <BentoCard href="/admin/rh/utilisateurs">
          <p className="mb-4 text-sm text-neutral-500">Équipe active</p>
          {data.active_team.length > 0 ? (
            <>
              <AvatarStack users={data.active_team} />
              <p className="mt-4 text-xs text-neutral-400">
                <Users className="mr-1 inline size-3.5" />
                {data.active_team.length} membre{data.active_team.length > 1 ? "s" : ""} sur des leads/publications
              </p>
            </>
          ) : (
            <EmptyState label="Équipe" text="Personne n'est encore assigné" />
          )}
        </BentoCard>

        {/* 8. Répartition des leads par statut */}
        <BentoCard href="/admin/marketing/leads">
          <p className="mb-4 text-sm text-neutral-500">Leads par statut<br /><span className="text-xs text-neutral-400">{totalActiveLeads} actifs sur {data.total_leads}</span></p>
          {statusRows.length > 0 ? (
            <ProgressRows segments={statusRows} />
          ) : (
            <EmptyState label="Leads" text="Aucun lead pour l'instant" />
          )}
        </BentoCard>

        {/* 9. Devis envoyés cette semaine */}
        <BentoCard href="/admin/marketing/devis">
          <p className="mb-1 text-sm text-neutral-500">Devis envoyés<br /><span className="text-xs text-neutral-400">Cette semaine</span></p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-neutral-900">
            {formatCurrency(data.quotes_sent_this_week.amount)} <span className="text-lg text-neutral-400">€</span>
          </p>
          <div className="mt-3">
            {data.quotes_sent_this_week.trend_percent !== null ? (
              <TrendPill
                percent={data.quotes_sent_this_week.trend_percent}
                positive={data.quotes_sent_this_week.trend_percent >= 0}
              />
            ) : (
              <span className="text-xs text-neutral-400">Aucun devis la semaine précédente</span>
            )}
          </div>
        </BentoCard>

        {/* 10. Pipeline utilisé */}
        <BentoCard href="/admin/marketing/leads">
          <p className="mb-4 text-sm text-neutral-500">Pipeline pondéré</p>
          <div className="relative mx-auto size-28">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                data={[{ value: pipelinePercent }]} startAngle={90} endAngle={-270}
                innerRadius="72%" outerRadius="100%" barSize={10}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" cornerRadius={10} fill="#f59e0b" background={{ fill: "#fffbeb" }} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold text-neutral-900">{formatCurrency(data.weighted_pipeline)} €</span>
            </div>
          </div>
          <div className="mt-3 flex justify-center gap-4 text-[0.7rem] text-neutral-500">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-500" /> Pondéré: {formatCurrency(data.weighted_pipeline)} €</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-amber-100" /> Estimé: {formatCurrency(data.active_pipeline_total_estimated)} €</span>
          </div>
        </BentoCard>
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Leads par source" subtitle="D'où viennent les prospects">
          <DonutChart data={data.leads_by_source} labels={LEAD_SOURCE_LABELS} />
        </ChartCard>
        <ChartCard title="Publications par statut" subtitle="Plan éditorial">
          <DonutChart data={data.social_posts_by_status} labels={SOCIAL_STATUS_LABELS} />
        </ChartCard>
        <ChartCard title="Publications publiées par plateforme">
          <DonutChart data={data.published_social_posts_by_platform} labels={PLATFORM_LABELS} />
        </ChartCard>
      </div>
    </div>
  );
}

function EmptyState({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col">
      <span className="mb-4 inline-flex w-fit items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
        {label}
      </span>
      <p className="flex flex-1 items-center gap-1.5 text-sm text-neutral-400">
        <Sparkles className="size-3.5 shrink-0" /> {text}
      </p>
    </div>
  );
}

