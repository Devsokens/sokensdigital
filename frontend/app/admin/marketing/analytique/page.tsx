import { RequireRole } from "@/components/admin/require-role";
import { AnalyticsDashboard } from "@/components/admin/analytics/analytics-dashboard";

export default function MarketingAnalyticsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING", "COMMERCIAL"]}>
      <AnalyticsDashboard department="marketing" />
    </RequireRole>
  );
}
