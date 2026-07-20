import { RequireRole } from "@/components/admin/require-role";
import { Invoices } from "@/components/admin/finance/invoices";

export default function FacturationPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE"]}>
      <Invoices />
    </RequireRole>
  );
}
