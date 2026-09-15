"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import {
  getMarketingAnalytics,
  getTechniqueAnalytics,
  type AnalyticsDepartment,
  type AnalyticsPeriod,
  type DatedValue,
  type LabeledValue,
  type MarketingAnalytics,
  type TechniqueAnalytics,
} from "@/lib/api/analytics";
import { cn } from "@/lib/utils";

const PERIODS: AnalyticsPeriod[] = [7, 30, 90];
const NUMBER = new Intl.NumberFormat("fr-FR");

type LoadState =
  | { kind: "loading" }
  | { kind: "not-configured" }
  | { kind: "error"; message: string }
  | { kind: "marketing"; data: MarketingAnalytics }
  | { kind: "technique"; data: TechniqueAnalytics };

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums text-neutral-900",
          tone === "good" && "text-emerald-700",
          tone === "warn" && "text-amber-600",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-neutral-400">{hint}</p>}
    </div>
  );
}

/** Barres horizontales en CSS pur : suffisant pour un classement, et aucune
 * librairie de graphiques à charger sur cet écran. */
function BarList({ title, items, unit, empty }: { title: string; items: LabeledValue[]; unit?: string; empty: string }) {
  const max = Math.max(1, ...items.map((i) => i.value ?? 0));
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-neutral-700" title={item.label}>
                  {item.label}
                </span>
                <span className="shrink-0 font-medium tabular-nums text-neutral-900">
                  {item.value === null ? "—" : `${NUMBER.format(item.value)}${unit ?? ""}`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${((item.value ?? 0) / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DailyBars({ title, series, empty }: { title: string; series: DatedValue[]; empty: string }) {
  const max = Math.max(1, ...series.map((p) => p.value));
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
      {series.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-400">{empty}</p>
      ) : (
        <div className="mt-4 flex h-32 items-end gap-[2px]" role="img" aria-label={title}>
          {series.map((point) => (
            <div
              key={point.date}
              title={`${new Date(point.date).toLocaleDateString("fr-FR")} : ${NUMBER.format(point.value)}`}
              className="min-w-[2px] flex-1 rounded-t bg-primary/60 hover:bg-primary"
              style={{ height: `${Math.max(2, (point.value / max) * 100)}%` }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Seuils « bon » de Google pour le p75 des Core Web Vitals. */
function vitalTone(value: number | null, good: number, poor: number): "good" | "warn" | "bad" | undefined {
  if (value === null) return undefined;
  if (value <= good) return "good";
  if (value <= poor) return "warn";
  return "bad";
}

function MarketingView({ data }: { data: MarketingAnalytics }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Visiteurs uniques" value={NUMBER.format(data.visitors)} />
        <Kpi label="Pages vues" value={NUMBER.format(data.pageviews)} hint={`${NUMBER.format(data.sessions)} sessions`} />
        <Kpi label="Demandes de projet" value={NUMBER.format(data.leads)} />
        <Kpi label="Taux de conversion" value={`${data.conversion_rate.toLocaleString("fr-FR")} %`} hint="Demandes / visiteurs" />
      </div>
      <DailyBars title="Visiteurs par jour" series={data.daily_visitors} empty="Aucune visite sur la période." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarList title="Entonnoir de conversion" items={data.funnel} empty="Pas encore de données." />
        <BarList title="Pages les plus vues" items={data.top_pages} empty="Aucune page vue." />
        <BarList title="Sources de trafic" items={data.sources} empty="Aucune source identifiée." />
        <BarList title="Campagnes (utm_campaign)" items={data.campaigns} empty="Aucune campagne taguée sur la période." />
      </div>
    </div>
  );
}

function TechniqueView({ data }: { data: TechniqueAnalytics }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Erreurs JS" value={NUMBER.format(data.exceptions)} tone={data.exceptions > 0 ? "warn" : "good"} />
        <Kpi label="Visiteurs touchés" value={NUMBER.format(data.affected_visitors)} />
        <Kpi
          label="LCP p75"
          value={data.lcp_p75_ms === null ? "—" : `${NUMBER.format(data.lcp_p75_ms)} ms`}
          hint="Bon ≤ 2 500 ms"
          tone={vitalTone(data.lcp_p75_ms, 2500, 4000)}
        />
        <Kpi
          label="INP p75"
          value={data.inp_p75_ms === null ? "—" : `${NUMBER.format(data.inp_p75_ms)} ms`}
          hint="Bon ≤ 200 ms"
          tone={vitalTone(data.inp_p75_ms, 200, 500)}
        />
        <Kpi
          label="CLS p75"
          value={data.cls_p75 === null ? "—" : data.cls_p75.toLocaleString("fr-FR")}
          hint="Bon ≤ 0,1"
          tone={vitalTone(data.cls_p75, 0.1, 0.25)}
        />
      </div>
      <DailyBars title="Erreurs par jour" series={data.daily_errors} empty="Aucune erreur remontée sur la période." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarList title="Erreurs les plus fréquentes" items={data.top_errors} empty="Aucune erreur remontée." />
        <BarList title="Pages les plus lentes (LCP p75)" items={data.slow_pages} unit=" ms" empty="Pas encore de mesure de performance." />
        <BarList title="Appareils" items={data.devices} empty="Pas encore de données." />
        <BarList title="Navigateurs" items={data.browsers} empty="Pas encore de données." />
      </div>
    </div>
  );
}

export function AnalyticsDashboard({ department }: { department: AnalyticsDepartment }) {
  const [days, setDays] = useState<AnalyticsPeriod>(30);
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const response = department === "marketing" ? await getMarketingAnalytics(days) : await getTechniqueAnalytics(days);
      if (!response.configured) {
        setState({ kind: "not-configured" });
      } else if (department === "marketing") {
        setState({ kind: "marketing", data: response as MarketingAnalytics });
      } else {
        setState({ kind: "technique", data: response as TechniqueAnalytics });
      }
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 503
          ? "Les données analytiques sont momentanément indisponibles."
          : "Impossible de charger les données analytiques.";
      setState({ kind: "error", message });
    }
  }, [department, days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Analytique web</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {department === "marketing"
              ? "Audience, acquisition et conversion des visiteurs du site public."
              : "Erreurs et performance ressenties par les visiteurs du site public."}{" "}
            Visiteurs ayant accepté les cookies analytiques uniquement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white p-0.5" role="group" aria-label="Période">
            {PERIODS.map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setDays(period)}
                aria-pressed={days === period}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  days === period ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900",
                )}
              >
                {period} j
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Actualiser"
            className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>

      {state.kind === "loading" && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      )}

      {state.kind === "not-configured" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" /> PostHog n&apos;est pas encore configuré
          </p>
          <p className="mt-2 text-amber-700">
            La collecte côté site et la lecture de ce tableau de bord attendent leurs clés : voir la section
            « PostHog » de docs/ROADMAP_TECHNIQUE.md.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span>{state.message}</span>
          <button type="button" onClick={() => void load()} className="rounded-full border border-destructive/30 px-3 py-1 text-xs font-medium">
            Réessayer
          </button>
        </div>
      )}

      {state.kind === "marketing" && <MarketingView data={state.data} />}
      {state.kind === "technique" && <TechniqueView data={state.data} />}
    </div>
  );
}
