import { RequireRole } from "@/components/admin/require-role";
import { AuditLogList } from "@/components/admin/rh/audit-log-list";

export default function AuditLogPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN"]}>
      <AuditLogList />
    </RequireRole>
  );
}
