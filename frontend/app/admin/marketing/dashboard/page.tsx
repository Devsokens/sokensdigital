import { RequireRole } from "@/components/admin/require-role";
import { MarketingDashboardView } from "@/components/admin/marketing/dashboard";

export default function MarketingDashboardPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING", "COMMERCIAL", "CHEF_DE_PROJET"]}>
      <MarketingDashboardView />
    </RequireRole>
  );
}
