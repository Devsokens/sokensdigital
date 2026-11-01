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

// Palette de l'anneau de répartition, dans l'ordre des catégories renvoyées
// (triées par nombre de projets décroissant).
const CATEGORY_COLORS = ["#10b981", "#6366f1", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6"];

const NEUTRAL_SPARKLINE = "#94a3b8";

/** Variation en % entre deux valeurs, null quand la référence est nulle
 * (une hausse « depuis zéro » n'a pas de pourcentage qui ait un sens). */
function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function formatPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

/** Mini Sparkline Curve component using clean SVG */
function MiniSparkline({ points, color }: { points: number[]; color: string }) {
  const width = 64;
  const height = 22;
  // Moins de deux points : rien à relier, on trace une ligne plate.
  const series = points.length >= 2 ? points : [points[0] ?? 0, points[0] ?? 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const path = series
    .map((val, idx) => {
      const x = (idx / (series.length - 1)) * width;
      const y = max === min ? height / 2 : height - ((val - min) / range) * (height - 6) - 3;
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
  /** Absent quand il n'y a pas de période de référence pour comparer. */
  trendPercent?: string;
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
          <MiniSparkline points={sparklinePoints} color={sparklineColor} />
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 pt-1 text-[11px]">
        {trendPercent && (
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
        )}
        <span className="truncate text-neutral-400">{trendLabel}</span>
      </div>
    </div>
  );
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 23;

/** Dual-ring circular gauge for Goals / Conversions (compact height) */
function GoalGaugeWidget({
  quotes,
  tasks,
}: {
  quotes: GlobalDashboard["quotes"];
  tasks: GlobalDashboard["tasks"];
}) {
  const [gaugeTab, setGaugeTab] = useState<"devis" | "livrables">("devis");

  const done = gaugeTab === "devis" ? quotes.signed : tasks.done;
  const pending = gaugeTab === "devis" ? quotes.pending : tasks.pending;
  const total = done + pending;
  const doneShare = total ? done / total : 0;
  const doneLabel = gaugeTab === "devis" ? "Signés" : "Terminées";
  const pendingLabel = gaugeTab === "devis" ? "En cours" : "À livrer";

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
          {total ? `${(doneShare * 100).toFixed(1)}%` : "—"}
        </span>
      </div>

      <div className="my-1 flex items-center justify-between gap-2">
        {/* SVG Circular Progress Gauge */}
        <div className="relative flex shrink-0 items-center justify-center">
          <svg className="size-14 -rotate-90 transform" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="23" fill="transparent" stroke="#f3f4f6" strokeWidth="6" />
            {pending > 0 && (
              <circle
                cx="30"
                cy="30"
                r="23"
                fill="transparent"
                stroke="#f97316"
                strokeWidth="6"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={0}
                strokeLinecap="round"
              />
            )}
            {done > 0 && (
              <circle
                cx="30"
                cy="30"
                r="23"
                fill="transparent"
                stroke="#10b981"
                strokeWidth="6"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - doneShare)}
                strokeLinecap="round"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-sm font-black leading-none text-neutral-900">{total}</span>
          </div>
        </div>

        {/* Counts breakdown */}
        <div className="flex-1 space-y-1 text-[11px]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-neutral-500">
              <span className="size-2 rounded-full bg-[#10b981]" /> {doneLabel}
            </span>
            <strong className="font-semibold text-neutral-900">{done}</strong>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-neutral-500">
              <span className="size-2 rounded-full bg-[#f97316]" /> {pendingLabel}
            </span>
            <strong className="font-semibold text-neutral-900">{pending}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GlobalDashboardView({ data }: { data: GlobalDashboard }) {
  const [activityView, setActivityView] = useState<"days" | "months">("days");

  const cashNum = parseFloat(data.cash_balance) || 0;
  const cashPrevious = parseFloat(data.cash_balance_previous_month_end) || 0;
  const pipelineNum = parseFloat(data.weighted_pipeline) || 0;

  const leadsChange = percentChange(data.leads_this_month, data.leads_previous_month);
  const cashChange = percentChange(cashNum, cashPrevious);
  const deliverySeries = data.trends.avg_delivery_days.filter((v): v is number => v !== null);

  const activityData = activityView === "days" ? data.activity_weekly : data.activity_monthly;
  const activityCurrent = activityData.reduce((sum, point) => sum + point.current, 0);
  const activityPrevious = activityData.reduce((sum, point) => sum + point.previous, 0);
  const activityChange = percentChange(activityCurrent, activityPrevious);
  const periodLabels =
    activityView === "days"
      ? { current: "Semaine en cours", previous: "Semaine précédente" }
      : { current: "Année en cours", previous: "Année précédente" };

  const categories = data.project_categories.map((category, index) => ({
    ...category,
    color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
  }));
  const categoryTotal = categories.reduce((sum, c) => sum + c.count, 0);
  const categoryBudget = categories.reduce((sum, c) => sum + (parseFloat(c.budget) || 0), 0);

  return (
    <div className="space-y-6 pb-12">
      {/* Row 1: KPI Cards + Gauge Widget (compact height) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <TrendKpiCard
          title="Pipeline commercial pondéré"
          value={formatFcfa(pipelineNum)}
          sparklinePoints={data.trends.leads}
          sparklineColor="#10b981"
          trendPercent={leadsChange === null ? undefined : formatPercent(leadsChange)}
          trendLabel={
            leadsChange === null
              ? `${plural(data.leads_this_month, "nouveau lead", "nouveaux leads")} ce mois`
              : "nouveaux leads vs mois précédent"
          }
          isPositive={leadsChange === null || leadsChange >= 0}
        />

        <TrendKpiCard
          title="Trésorerie nette disponible"
          value={formatFcfa(cashNum)}
          sparklinePoints={data.trends.cash_balance.map((v) => parseFloat(v) || 0)}
          sparklineColor={cashNum >= cashPrevious ? "#10b981" : "#f43f5e"}
          trendPercent={cashChange === null ? undefined : formatPercent(cashChange)}
          trendLabel={cashChange === null ? "Solde du compte bancaire (512)" : "vs fin du mois précédent"}
          isPositive={cashNum >= cashPrevious}
        />

        <TrendKpiCard
          title="Délai moyen de livraison"
          value={data.avg_delivery_days === null ? "—" : plural(Math.round(data.avg_delivery_days), "jour")}
          sparklinePoints={deliverySeries}
          sparklineColor={NEUTRAL_SPARKLINE}
          trendLabel={
            data.delivered_projects
              ? `Sur ${plural(data.delivered_projects, "projet livré", "projets livrés")}`
              : "Aucun projet terminé daté"
          }
        />

        <TrendKpiCard
          title="Projets actifs en cours"
          value={plural(data.active_projects, "actif")}
          sparklinePoints={data.trends.projects_created}
          sparklineColor="#10b981"
          trendPercent={data.projects_created_this_month ? `+${data.projects_created_this_month}` : undefined}
          trendLabel={
            data.projects_created_this_month
              ? "nouveaux projets ce mois"
              : "Aucun nouveau projet ce mois"
          }
          isPositive
        />

        <GoalGaugeWidget quotes={data.quotes} tasks={data.tasks} />
      </div>

      {/* Row 2: Main Activity Chart + Category Distribution Donut */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-neutral-900">Activité & Charge opérationnelle</h2>
              <p className="text-xs text-neutral-400">
                Demandes, devis, projets, tâches, factures, tickets et besoins créés
              </p>
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
              <BarChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="current" name={periodLabels.current} fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={18} />
                <Bar dataKey="previous" name={periodLabels.previous} fill="#d1fae5" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#10b981]" /> {periodLabels.current}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[#a7f3d0]" /> {periodLabels.previous}
              </span>
            </div>
            <span
              className={`font-semibold ${
                activityChange !== null && activityChange < 0 ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              {activityChange === null
                ? plural(activityCurrent, "élément créé", "éléments créés")
                : `${formatPercent(activityChange)} d'activité`}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-sm lg:col-span-5">
          <div className="border-b border-neutral-100 pb-3">
            <h2 className="text-base font-bold text-neutral-900">Répartition par pôle d&apos;expertise</h2>
            <p className="text-xs text-neutral-400">Projets par catégorie et budget engagé</p>
          </div>

          {categories.length === 0 ? (
            <p className="flex flex-1 items-center justify-center py-16 text-center text-sm text-neutral-400">
              Aucun projet enregistré pour l&apos;instant.
            </p>
          ) : (
            <>
              <div className="relative my-2 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={90}
                      paddingAngle={categories.length > 1 ? 3 : 0}
                      cornerRadius={6}
                      strokeWidth={0}
                    >
                      {categories.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 12 }}
                      formatter={(val) => [plural(Number(val), "projet"), "Projets"]}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold text-neutral-400">Budget total</span>
                  <span className="text-sm font-black text-neutral-900 sm:text-base">
                    {formatFcfa(categoryBudget)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-neutral-100 pt-3 text-[11px]">
                {categories.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate text-neutral-600">{item.name}</span>
                    </div>
                    <span className="ml-1 shrink-0 font-bold text-neutral-900">
                      {Math.round((item.count / categoryTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 3: Cross-Department Operational Status Hub */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">Performance par département</h2>
          <span className="text-xs text-neutral-400">5 pôles opérationnels connectés</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Link
            href="/admin/finance/dashboard"
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
            <p className="mt-1 text-lg font-bold text-neutral-900">{plural(data.active_projects, "projet actif", "projets actifs")}</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Taux de livraison</span>
              <strong className="font-bold text-emerald-600">
                {data.delivery_rate === null ? "—" : `${data.delivery_rate}%`}
              </strong>
            </div>
          </Link>

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
            <p className="mt-1 text-lg font-bold text-neutral-900">{plural(data.active_employees, "employé actif", "employés actifs")}</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Recrutements ce mois</span>
              <strong className="font-bold text-violet-700">+{data.new_hires_this_month}</strong>
            </div>
          </Link>

          <Link
            href="/admin/marketing/dashboard"
            className="group rounded-2xl border border-neutral-200/80 bg-white p-4.5 shadow-sm transition hover:border-amber-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <TrendingUp className="size-4.5" />
              </span>
              <ExternalLink className="size-3.5 text-neutral-300 transition group-hover:text-amber-600" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Marketing & Ventes</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{plural(data.total_leads, "lead")} au total</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Posts publiés ce mois</span>
              <strong className="font-bold text-amber-700">{data.social_posts_published_this_month}</strong>
            </div>
          </Link>

          <Link
            href="/admin/support/tickets"
            className="group rounded-2xl border border-neutral-200/80 bg-white p-4.5 shadow-sm transition hover:border-pink-400 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-pink-50 text-pink-600">
                <Headset className="size-4.5" />
              </span>
              <ExternalLink className="size-3.5 text-neutral-300 transition group-hover:text-pink-600" />
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">Support Client</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{plural(data.open_tickets, "ticket")} en cours</p>
            <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              <span>Taux de résolution</span>
              <strong className="font-bold text-pink-700">
                {data.ticket_resolution_rate === null ? "—" : `${data.ticket_resolution_rate}%`}
              </strong>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
