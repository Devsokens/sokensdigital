import { RequireRole } from "@/components/admin/require-role";
import { UserRoleList } from "@/components/admin/rh/user-role-list";

export default function UtilisateursPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN"]}>
      <UserRoleList />
    </RequireRole>
  );
}
