import { RequireRole } from "@/components/admin/require-role";
import { BankReconciliation } from "@/components/admin/finance/bank-reconciliation";

export default function RapprochementPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE"]}>
      <BankReconciliation />
    </RequireRole>
  );
}
