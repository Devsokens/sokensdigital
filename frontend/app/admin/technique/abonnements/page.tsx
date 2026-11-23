import { RequireRole } from "@/components/admin/require-role";
import { SubscriptionsHub } from "@/components/admin/services/subscriptions-hub";

export default function SubscriptionsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_TECHNIQUE", "RESPONSABLE_OPERATIONS", "COMPTABLE"]}>
      <SubscriptionsHub pole="MAINTENANCE" />
    </RequireRole>
  );
}
