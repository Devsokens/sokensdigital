import { RequireRole } from "@/components/admin/require-role";
import { EmploymentContractEditor } from "@/components/admin/rh/employment-contract-editor";

export default function NouveauContratTravailPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_RH"]}>
      <EmploymentContractEditor />
    </RequireRole>
  );
}
