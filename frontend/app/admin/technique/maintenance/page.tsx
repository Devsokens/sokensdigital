import { RequireRole } from "@/components/admin/require-role";
import { Maintenance } from "@/components/admin/technique/maintenance";

export default function MaintenancePage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "CHEF_DE_PROJET", "DEVELOPPEUR"]}>
      <Maintenance />
    </RequireRole>
  );
}
