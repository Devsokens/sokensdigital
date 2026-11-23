import { RequireRole } from "@/components/admin/require-role";
import { ContractEditor } from "@/components/admin/contracts/contract-editor";

export default function NouveauContratPartenariatPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_ADMINISTRATIF"]}>
      <ContractEditor initialType="PARTENARIAT" />
    </RequireRole>
  );
}
