import { AuthProvider } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { SectionFilterProvider } from "@/lib/admin/section-filter-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>
        <SectionFilterProvider>
          <div className="flex min-h-screen w-full">
            <AdminSidebar />
            <div className="flex flex-1 flex-col lg:pl-64">
              <AdminHeader />
              <main className="flex-1 bg-white px-6 py-8 text-neutral-900 lg:px-10">
                {children}
              </main>
            </div>
          </div>
        </SectionFilterProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
