import { RequireRole } from "@/components/admin/require-role";
import { Tresorerie } from "@/components/admin/finance/tresorerie";

export default function TresoreriePage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "CAISSIER"]}>
      <Tresorerie />
    </RequireRole>
  );
}
