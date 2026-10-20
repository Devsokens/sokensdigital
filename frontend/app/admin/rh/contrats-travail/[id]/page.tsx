import { RequireRole } from "@/components/admin/require-role";
import { EmploymentContractEditPage } from "@/components/admin/rh/employment-contract-edit-page";

export default async function ContratTravailDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_RH"]}>
      <EmploymentContractEditPage id={id} />
    </RequireRole>
  );
}
