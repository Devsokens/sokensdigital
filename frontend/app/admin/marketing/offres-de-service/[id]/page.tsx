import { RequireRole } from "@/components/admin/require-role";
import { ServiceProposalEditPage } from "@/components/admin/marketing/service-proposal-edit-page";

export default async function ServiceProposalDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING", "COMMERCIAL", "CHEF_DE_PROJET"]}>
      <ServiceProposalEditPage id={id} />
    </RequireRole>
  );
}
