import { RequireRole } from "@/components/admin/require-role";
import { Encaissements } from "@/components/admin/finance/encaissements";

export default function EncaissementsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE", "CAISSIER"]}>
      <Encaissements />
    </RequireRole>
  );
}
