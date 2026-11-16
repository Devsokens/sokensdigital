import { redirect } from "next/navigation";
import { RequireRole } from "@/components/admin/require-role";
import { EmploymentContractEditor } from "@/components/admin/rh/employment-contract-editor";

export default async function NouveauContratTravailPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  // Les contrats clients suivent désormais le modèle de contrat de
  // prestation de services (éditeur dédié).
  const { type } = await searchParams;
  if (type === "client") redirect("/admin/rh/contrats-travail/prestation/nouveau");
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_RH"]}>
      <EmploymentContractEditor initialPartyType="SALARIE" />
    </RequireRole>
  );
}
