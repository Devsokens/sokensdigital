import { RequireRole } from "@/components/admin/require-role";
import { FinanceDashboard } from "@/components/admin/finance/finance-dashboard";

export default function FinanceDashboardPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER"]}>
      <FinanceDashboard />
    </RequireRole>
  );
}
