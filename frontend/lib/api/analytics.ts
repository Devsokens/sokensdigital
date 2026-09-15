import { apiFetch } from "@/lib/api/client";

export type AnalyticsPeriod = 7 | 30 | 90;
export type AnalyticsDepartment = "marketing" | "technique";

export interface LabeledValue {
  label: string;
  value: number | null;
}

export interface DatedValue {
  date: string;
  value: number;
}

interface NotConfigured {
  configured: false;
  days: number;
}

export interface MarketingAnalytics {
  configured: true;
  days: number;
  visitors: number;
  pageviews: number;
  sessions: number;
  leads: number;
  quotes_accepted: number;
  conversion_rate: number;
  daily_visitors: DatedValue[];
  top_pages: LabeledValue[];
  sources: LabeledValue[];
  campaigns: LabeledValue[];
  funnel: LabeledValue[];
}

export interface TechniqueAnalytics {
  configured: true;
  days: number;
  exceptions: number;
  affected_visitors: number;
  lcp_p75_ms: number | null;
  inp_p75_ms: number | null;
  cls_p75: number | null;
  top_errors: LabeledValue[];
  slow_pages: LabeledValue[];
  devices: LabeledValue[];
  browsers: LabeledValue[];
  daily_errors: DatedValue[];
}

/** Lecture via le proxy Django (core/analytics_views.py) — jamais d'appel
 * direct à l'API PostHog depuis le navigateur : la clé de lecture donne
 * accès à tout le projet et reste côté serveur. */
export function getMarketingAnalytics(days: AnalyticsPeriod) {
  return apiFetch<MarketingAnalytics | NotConfigured>(`/api/v1/analytics/marketing/?days=${days}`);
}

export function getTechniqueAnalytics(days: AnalyticsPeriod) {
  return apiFetch<TechniqueAnalytics | NotConfigured>(`/api/v1/analytics/technique/?days=${days}`);
}
