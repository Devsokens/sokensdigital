import { RequireRole } from "@/components/admin/require-role";
import { ContractEditPage } from "@/components/admin/contracts/contract-edit-page";

export default async function ContratPrestationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_RH"]}>
      <ContractEditPage id={id} />
    </RequireRole>
  );
}
