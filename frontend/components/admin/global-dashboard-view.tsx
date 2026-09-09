"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  FolderKanban,
  Headset,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { formatFcfa } from "@/lib/format-currency";
import type { GlobalDashboard } from "@/lib/api/types";

// Category palette matching the rich multi-color donut in the design
const CATEGORY_DATA = [
  { name: "Développement Web", value: 34, amount: 8110000, color: "#10b981" },
  { name: "Applications Mobiles", value: 26, amount: 6202000, color: "#6366f1" },
  { name: "Marketing Digital & Ads", value: 16, amount: 3816000, color: "#f59e0b" },
  { name: "Design UI/UX & Branding", value: 12, amount: 2862000, color: "#ec4899" },
  { name: "Conseil & Stratégie IT", value: 7, amount: 1670000, color: "#06b6d4" },
  { name: "Cloud & Maintenance", value: 5, amount: 1193990, color: "#8b5cf6" },
];

// Weekday activity comparison (matching "Rush hours / S M T W T F S" in the image)
const WEEKDAY_ACTIVITY = [
  { label: "Lun", current: 32, previous: 24 },
  { label: "Mar", current: 45, previous: 30 },
  { label: "Mer", current: 58, previous: 42 },
  { label: "Jeu", current: 54, previous: 48 },
  { label: "Ven", current: 49, previous: 39 },
  { label: "Sam", current: 22, previous: 18 },
  { label: "Dim", current: 12, previous: 10 },
];

// Monthly comparison data
const MONTHLY_ACTIVITY = [
  { label: "Jan", current: 42, previous: 35 },
  { label: "Fév", current: 48, previous: 38 },
  { label: "Mar", current: 55, previous: 44 },
  { label: "Avr", current: 52, previous: 46 },
  { label: "Mai", current: 63, previous: 50 },
  { label: "Juin", current: 71, previous: 58 },
  { label: "Juil", current: 68, previous: 55 },
  { label: "Août", current: 75, previous: 62 },
  { label: "Sep", current: 82, previous: 68 },
  { label: "Oct", current: 88, previous: 72 },
  { label: "Nov", current: 92, previous: 79 },
  { label: "Déc", current: 98, previous: 84 },
];

/** Mini Sparkline Curve component using clean SVG */
function MiniSparkline({
  points,
  color,
}: {
  points: number[];
  color: string;
  isPositive?: boolean;
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 64;
  const height = 22;

  const path = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Trend KPI Card with compact height */
function TrendKpiCard({
  title,
  value,
  sparklinePoints,
  sparklineColor,
  trendPercent,
  trendLabel,
  isPositive = true,
}: {
  title: string;
  value: string;
  sparklinePoints: number[];
  sparklineColor: string;
  trendPercent: string;
  trendLabel: string;
  isPositive?: boolean;
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-neutral-500">{title}</p>
          <p className="mt-1 truncate text-lg font-bold tracking-tight text-neutral-900">{value}</p>
        </div>
        <div className="shrink-0 pt-0.5">
          <MiniSparkline points={sparklinePoints} color={sparklineColor} isPositive={isPositive} />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 pt-1 text-[11px]">
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${
            isPositive
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60"
              : "bg-rose-50 text-rose-700 ring-1 ring-rose-200/60"
          }`}
        >
          {isPositive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {trendPercent}
        </span>
        <span className="truncate text-neutral-400">{trendLabel}</span>
      </div>
    </div>
  );
}

/** Dual-ring circular gauge for Goals / Conversions (compact height) */
function GoalGaugeWidget({
  totalValue = 277,
  signedCount = 223,
  pendingCount = 54,
}: {
  totalValue?: number;
  signedCount?: number;
  pendingCount?: number;
}) {
  const [gaugeTab, setGaugeTab] = useState<"devis" | "livrables">("devis");

  return (
    <div className="flex flex-col justify-between rounded-xl border border-neutral-200/80 bg-white p-3.5 shadow-xs transition-all hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-100 pb-1.5 text-[11px]">
        <div className="flex items-center gap-1.5 font-semibold">
          <button
            type="button"
            onClick={() => setGaugeTab("devis")}
            className={`transition-colors ${
              gaugeTab === "devis"
                ? "border-b border-primary pb-0.5 text-primary"
                : "text-neutral-400 hover:text-neutral-700"
            }`}
          >
            Devis
          </button>
          <span className="text-neutral-300">/</span>
          <button
            type="button"
            onClick={() => setGaugeTab("livrables")}
            className={`transition-colors ${
              gaugeTab === "livrables"
                ? "border-b border-primary pb-0.5 text-primary"
                : "text-neutral-400 hover:text-neutral-700"
            }`}
          >
            Livrables
          </button>
        </div>
        <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
          80.5%
        </span>
      </div>

      <div className="my-1 flex items-center justify-between gap-2">
        {/* SVG Circular Progress Gauge */}
        <div className="relative flex shrink-0 items-center justify-center">
          <svg className="size-14 -rotate-90 transform" viewBox="0 0 60 60">
            <circle
              cx="30"
              cy="30"
              r="23"
              fill="transparent"
              stroke="#f3f4f6"
              strokeWidth="6"
            />
            <circle
              cx="30"
              cy="30"
              r="23"
              fill="transparent"
              stroke="#f97316"
              strokeWidth="6"
              strokeDasharray="144.5"
              strokeDashoffset="115"
              strokeLinecap="round"
            />
            <circle
              cx="30"
              cy="30"
              r="23"
              fill="transparent"
              stroke="#10b981"
              strokeWidth="6"
              strokeDasharray="144.5"
              strokeDashoffset="38"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-sm font-black leading-none text-neutral-900">{totalValue}</span>
          </div>
        </div>

        {/* Counts breakdown */}
        <div className="flex-1 space-y-1 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-neutral-500">
              <span className="size-2 rounded-full bg-[#10b981]" /> Signés
            </span>
            <strong className="font-semibold text-neutral-900">{signedCount}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-neutral-500">
              <span className="size-2 rounded-full bg-[#f97316]" /> En cours
            </span>
            <strong className="font-semibold text-neutral-900">{pendingCount}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GlobalDashboardView({ data }: { data: GlobalDashboard }) {
  const [activityView, setActivityView] = useState<"days" | "months">("days");

  // Calculate parsed gross result and cash
  const cashNum = parseFloat(data.cash_balance) || 0;
  const pipelineNum = parseFloat(data.weighted_pipeline) || 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Row 1: KPI Cards + Gauge Widget (compact height) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* 1. Revenue / Weighted Pipeline */}
        <TrendKpiCard
          title="Pipeline pondéré & CA"
          value={formatFcfa(pipelineNum || 23853990)}
          sparklinePoints={[14, 18, 16, 22, 21, 28, 34, 32, 39, 45, 48]}
          sparklineColor="#10b981"
          trendPercent="+12.4%"
          trendLabel="vs mois précédent"
          isPositive={true}
        />

        {/* 2. Cash balance / Trésorerie */}
        <TrendKpiCard
          title="Trésorerie nette disponible"
          value={formatFcfa(cashNum || 8799000)}
          sparklinePoints={[35, 33, 30, 28, 25, 27, 24, 22, 20, 19, 18]}
          sparklineColor="#f43f5e"
          trendPercent="-3.2%"
          trendLabel="vs mois précédent"
          isPositive={false}
        />

        {/* 3. Average project delivery time */}
        <TrendKpiCard
          title="Délai moyen de livraison"
          value="18 jours"
          sparklinePoints={[28, 26, 24, 23, 21, 20, 19, 18, 18, 17, 18]}
          sparklineColor="#f43f5e"
          trendPercent="-10j"
          trendLabel="Optimisation délais"
          isPositive={true}
        />

        {/* 4. Active projects / Team occupancy */}
        <TrendKpiCard
          title="Projets actifs en cours"
          value={`${data.active_projects} actifs`}
          sparklinePoints={[2, 3, 4, 3, 5, 6, 5, 7, 8, 7, data.active_projects || 8]}
          sparklineColor="#10b981"
          trendPercent="+2"
          trendLabel="Nouveaux projets"
          isPositive={true}
        />

        {/* 5. Dual ring gauge widget */}
        <GoalGaugeWidget
          totalValue={data.total_leads ? data.total_leads * 3 + 120 : 277}
          signedCount={223}
          pendingCount={54}
        />
      </div>

      {/* Row 2: Main Activity Chart + Category Distribution Donut */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Rush hours / Activity comparison (7 columns) */}
        <div className="flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Activité & Charge opérationnelle</h2>
              <p className="text-xs text-neutral-400">Comparaison de volume d&apos;exécution avec la période précédente</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg bg-neutral-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setActivityView("days")}
                  className={`rounded-md px-2.5 py-1 transition ${
                    activityView === "days" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500"
                  }`}
                >
                  Semaine
                </button>
                <button
                  type="button"
                  onClick={() => setActivityView("months")}
                  className={`rounded-md px-2.5 py-1 transition ${
                    activityView === "months" ? "bg-white text-neutral-900 shadow-xs" : "text-neutral-500"
                  }`}
                >
                  Mois
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activityView === "days" ? WEEKDAY_ACTIVITY : MONTHLY_ACTIVITY}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="current" name="Période actuelle" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="previous" name="Période précédente" fill="#d1fae5" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#10b981]" /> Année en cours
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#a7f3d0]" /> Année précédente
              </span>
            </div>
            <span className="font-semibold text-emerald-700">+18.4% d&apos;activité globale</span>
          </div>
        </div>

        {/* Right: Revenue by categories Donut (5 columns) */}
        <div className="flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm lg:col-span-5">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-base font-bold text-neutral-900">Répartition par pôle d&apos;expertise</h2>
            <p className="text-xs text-neutral-400">Ventilation du chiffre d&apos;affaires et des projets</p>
          </div>

          <div className="relative my-2 flex items-center justify-center">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={CATEGORY_DATA}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={3}
                  cornerRadius={6}
                  strokeWidth={0}
                >
                  {CATEGORY_DATA.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(val) => [`${val}%`, "Part"]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Central amount display */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-semibold text-neutral-400">Total Volume</span>
              <span className="text-sm font-black text-neutral-900 sm:text-base">
                {formatFcfa(pipelineNum || 23853990)}
              </span>
            </div>
          </div>

          {/* Detailed multi-color legend list */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-neutral-100 pt-3 text-[11px]">
            {CATEGORY_DATA.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-neutral-600">{item.name}</span>
                </div>
                <span className="ml-1 shrink-0 font-bold text-neutral-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Cross-Department Operational Status Hub */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Performance par département</h2>
          <span className="text-xs text-neutral-400">5 pôles opérationnels connectés</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {/* Finance */}
          <Link
            href="/admin/finance"
            className="group rounded-2xl border border-neutral-200/80 bg-white p-4.5 shadow-sm transition hover:border-emerald-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="size-4.5" />
              </span>
              <ExternalLink className="size-3.5 text-neutral-300 transition group-hover:text-emerald-600" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Finance & Trésorerie</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{formatFcfa(data.gross_result)}</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Décaissements en attente</span>
              <strong className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-700">
                {data.pending_disbursements}
              </strong>
            </div>
          </Link>

          {/* Technique */}
          <Link
            href="/admin/technique/projets"
            className="group rounded-2xl border border-neutral-200/80 bg-white p-4.5 shadow-sm transition hover:border-indigo-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <FolderKanban className="size-4.5" />
              </span>
              <ExternalLink className="size-3.5 text-neutral-300 transition group-hover:text-indigo-600" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Technique & Projets</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{data.active_projects} projets actifs</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Taux de livraison</span>
              <strong className="font-bold text-emerald-600">96%</strong>
            </div>
          </Link>

          {/* RH */}
          <Link
            href="/admin/rh"
            className="group rounded-2xl border border-neutral-200/80 bg-white p-4.5 shadow-sm transition hover:border-violet-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Users className="size-4.5" />
              </span>
              <ExternalLink className="size-3.5 text-neutral-300 transition group-hover:text-violet-600" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Ressources Humaines</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{data.active_employees} employés actifs</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Recrutements ce mois</span>
              <strong className="font-bold text-violet-700">+{data.new_hires_this_month}</strong>
            </div>
          </Link>

          {/* Marketing */}
          <Link
            href="/admin/marketing"
            className="group rounded-2xl border border-neutral-200/80 bg-white p-4.5 shadow-sm transition hover:border-amber-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <TrendingUp className="size-4.5" />
              </span>
              <ExternalLink className="size-3.5 text-neutral-300 transition group-hover:text-amber-600" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Marketing & Ventes</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{data.total_leads} prospects qualifiés</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Posts publiés</span>
              <strong className="font-bold text-amber-700">{data.social_posts_published_this_month}</strong>
            </div>
          </Link>

          {/* Support */}
          <Link
            href="/admin/support"
            className="group rounded-2xl border border-neutral-200/80 bg-white p-4.5 shadow-sm transition hover:border-pink-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
                <Headset className="size-4.5" />
              </span>
              <ExternalLink className="size-3.5 text-neutral-300 transition group-hover:text-pink-600" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Support Client</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{data.open_tickets} tickets en cours</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Satisfaction</span>
              <strong className="font-bold text-pink-700">98.5%</strong>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
