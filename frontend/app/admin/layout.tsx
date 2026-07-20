import { RequireAuth } from "@/components/auth/require-auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <main className="flex-1 bg-white px-6 py-8 text-neutral-900 lg:pl-72 lg:pr-10">
          {children}
        </main>
      </div>
    </RequireAuth>
  );
}
