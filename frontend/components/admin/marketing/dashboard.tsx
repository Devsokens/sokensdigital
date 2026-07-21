"use client";

import { useEffect, useState } from "react";
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
import { Loader2, Megaphone, Newspaper, TrendingUp, Users } from "lucide-react";
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

const PALETTE = ["#06b6d4", "#6366f1", "#f59e0b", "#f43f5e", "#8b5cf6", "#10b981"];

function formatCurrency(value: string) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value));
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));
}

function StatCard({
  label, value, sublabel, icon: Icon, accent,
}: { label: string; value: string; sublabel?: string; icon: React.ComponentType<{ className?: string }>; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div
        className="absolute -top-8 -right-8 size-24 rounded-full opacity-[0.08]"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs text-neutral-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-neutral-900">{value}</p>
          {sublabel && <p className="mt-1 text-[0.7rem] text-neutral-400">{sublabel}</p>}
        </div>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${accent}1a`, color: accent }}
        >
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pipeline pondéré"
          value={`${formatCurrency(data.weighted_pipeline)} €`}
          sublabel="Leads actifs × score de qualification"
          icon={TrendingUp}
          accent="#06b6d4"
        />
        <StatCard
          label="Leads au total"
          value={String(data.total_leads)}
          sublabel="Toutes sources confondues"
          icon={Users}
          accent="#6366f1"
        />
        <StatCard
          label="Taux de conversion"
          value={`${data.conversion_rate} %`}
          sublabel="Leads convertis / total"
          icon={Megaphone}
          accent="#f59e0b"
        />
        <StatCard
          label="Publications publiées"
          value={String(publishedTotal)}
          sublabel="Toutes plateformes confondues"
          icon={Newspaper}
          accent="#10b981"
        />
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
