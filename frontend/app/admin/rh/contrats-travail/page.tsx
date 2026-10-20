import { RequireRole } from "@/components/admin/require-role";
import { EmploymentContractList } from "@/components/admin/rh/employment-contract-list";

export default function ContratsTravailPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_RH"]}>
      <EmploymentContractList />
    </RequireRole>
  );
}
