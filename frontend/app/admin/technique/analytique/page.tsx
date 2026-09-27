import { RequireRole } from "@/components/admin/require-role";
import { AnalyticsDashboard } from "@/components/admin/analytics/analytics-dashboard";

export default function TechniqueAnalyticsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "CHEF_DE_PROJET", "DEVELOPPEUR"]}>
      <AnalyticsDashboard department="technique" />
    </RequireRole>
  );
}
