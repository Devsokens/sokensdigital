import { RequireRole } from "@/components/admin/require-role";
import { BlogPostList } from "@/components/admin/marketing/blog-post-list";

export default function BlogPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING"]}>
      <BlogPostList />
    </RequireRole>
  );
}
