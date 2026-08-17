import { RequireRole } from "@/components/admin/require-role";
import { Achats } from "@/components/admin/finance/achats";

export default function AchatsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE"]}>
      <Achats />
    </RequireRole>
  );
}
