import { RequireRole } from "@/components/admin/require-role";
import { SubscriptionsHub } from "@/components/admin/services/subscriptions-hub";

export default function SubscriptionsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING_COM", "COMMERCIAL", "COMPTABLE"]}>
      <SubscriptionsHub pole="COMMUNICATION" />
    </RequireRole>
  );
}
