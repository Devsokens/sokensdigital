import { RequireRole } from "@/components/admin/require-role";
import { SubscriptionDetail } from "@/components/admin/services/subscription-detail";

export default async function SubscriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING_COM", "COMMERCIAL", "COMPTABLE"]}>
      <SubscriptionDetail id={id} backHref="/admin/marketing/abonnements" />
    </RequireRole>
  );
}
