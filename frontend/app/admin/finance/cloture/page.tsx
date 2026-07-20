import { RequireRole } from "@/components/admin/require-role";
import { AccountingPeriods } from "@/components/admin/finance/accounting-periods";

export default function CloturePage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE"]}>
      <AccountingPeriods />
    </RequireRole>
  );
}
