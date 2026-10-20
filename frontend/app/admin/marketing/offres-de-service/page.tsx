import { RequireRole } from "@/components/admin/require-role";
import { ServiceProposalList } from "@/components/admin/marketing/service-proposal-list";

export default function ServiceProposalsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING", "COMMERCIAL", "CHEF_DE_PROJET"]}>
      <ServiceProposalList />
    </RequireRole>
  );
}
