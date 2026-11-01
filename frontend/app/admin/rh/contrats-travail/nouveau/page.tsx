import { RequireRole } from "@/components/admin/require-role";
import { EmploymentContractEditor } from "@/components/admin/rh/employment-contract-editor";

export default async function NouveauContratTravailPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  // ?type=client ouvre directement un contrat client (bouton dédié de la liste).
  const { type } = await searchParams;
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_RH"]}>
      <EmploymentContractEditor initialPartyType={type === "client" ? "CLIENT" : "SALARIE"} />
    </RequireRole>
  );
}
