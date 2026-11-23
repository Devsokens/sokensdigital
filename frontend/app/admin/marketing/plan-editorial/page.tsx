import { RequireRole } from "@/components/admin/require-role";
import { SocialPostList } from "@/components/admin/marketing/social-post-list";

export default function PlanEditorialPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING_COM", "COMMERCIAL"]}>
      <SocialPostList />
    </RequireRole>
  );
}
