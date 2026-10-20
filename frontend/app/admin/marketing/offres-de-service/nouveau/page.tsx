import { RequireRole } from "@/components/admin/require-role";
import { ServiceProposalEditor } from "@/components/admin/marketing/service-proposal-editor";

export default function NouveauServiceProposalPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING", "COMMERCIAL", "CHEF_DE_PROJET"]}>
      <ServiceProposalEditor />
    </RequireRole>
  );
}
