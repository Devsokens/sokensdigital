import { AuthProvider } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminHeader } from "@/components/admin/admin-header";
import { SectionFilterProvider } from "@/lib/admin/section-filter-context";
import { OnboardingProvider } from "@/lib/admin/onboarding-tour";
import { OnboardingOverlay } from "@/components/admin/onboarding-overlay";
import { ModuleTourOverlay } from "@/components/admin/module-tour-overlay";
import { MobileBottomNav } from "@/components/admin/mobile-bottom-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>
        <SectionFilterProvider>
          <OnboardingProvider>
            <div className="flex min-h-screen w-full print:block">
              <div className="print:hidden">
                <AdminSidebar />
              </div>
              <div className="flex flex-1 flex-col lg:pl-64 print:pl-0">
                <div className="print:hidden">
                  <AdminHeader />
                </div>
                <main className="flex-1 bg-white px-6 py-8 pb-28 text-neutral-900 lg:px-10 lg:pb-8 print:p-0">
                  {children}
                </main>
              </div>
            </div>
            <div className="print:hidden">
              <MobileBottomNav />
              <OnboardingOverlay />
              <ModuleTourOverlay />
            </div>
          </OnboardingProvider>
        </SectionFilterProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
