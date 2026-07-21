import { RequireRole } from "@/components/admin/require-role";
import { ContentManagement } from "@/components/admin/marketing/content-management";

export default function ContentManagementPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING"]}>
      <ContentManagement />
    </RequireRole>
  );
}
