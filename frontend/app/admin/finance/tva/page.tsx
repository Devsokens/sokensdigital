import { RequireRole } from "@/components/admin/require-role";
import { TaxDeclarations } from "@/components/admin/finance/tax-declarations";

export default function TvaPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE"]}>
      <TaxDeclarations />
    </RequireRole>
  );
}
