import { RequireRole } from "@/components/admin/require-role";
import { LeadList } from "@/components/admin/marketing/lead-list";

export default function LeadsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING", "COMMERCIAL"]}>
      <LeadList />
    </RequireRole>
  );
}
