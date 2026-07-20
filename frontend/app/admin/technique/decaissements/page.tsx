import { RequireRole } from "@/components/admin/require-role";
import { DisbursementList } from "@/components/admin/technique/disbursement-list";

export default function DecaissementsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "CHEF_DE_PROJET", "DIRECTEUR_FINANCIER", "COMPTABLE"]}>
      <DisbursementList />
    </RequireRole>
  );
}
