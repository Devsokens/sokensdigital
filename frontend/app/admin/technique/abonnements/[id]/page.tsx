import { RequireRole } from "@/components/admin/require-role";
import { SubscriptionDetail } from "@/components/admin/services/subscription-detail";

export default async function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_TECHNIQUE", "RESPONSABLE_OPERATIONS", "COMPTABLE"]}>
      <SubscriptionDetail id={id} backHref="/admin/technique/abonnements" />
    </RequireRole>
  );
}
