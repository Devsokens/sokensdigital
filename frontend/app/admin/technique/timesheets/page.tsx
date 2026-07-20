import { RequireRole } from "@/components/admin/require-role";
import { TimesheetList } from "@/components/admin/technique/timesheet-list";

export default function TimesheetsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "CHEF_DE_PROJET", "DEVELOPPEUR"]}>
      <TimesheetList />
    </RequireRole>
  );
}
