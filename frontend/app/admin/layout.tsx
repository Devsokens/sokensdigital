import { AuthProvider } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { OnboardingProvider } from "@/lib/admin/onboarding-tour";
import { OnboardingOverlay } from "@/components/admin/onboarding-overlay";
import { ModuleTourOverlay } from "@/components/admin/module-tour-overlay";
import { MobileBottomNav } from "@/components/admin/mobile-bottom-nav";
import { ProfileModalProvider } from "@/lib/admin/profile-modal-context";
import { ProfileSheet } from "@/components/profile/profile-sheet";
import { PermissionsProvider } from "@/lib/admin/permissions-context";
import { AdminAccessGuard } from "@/components/admin/admin-access-guard";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>
        <PermissionsProvider>
          <OnboardingProvider>
            <ProfileModalProvider>
              <AdminShell>
                <AdminAccessGuard>{children}</AdminAccessGuard>
              </AdminShell>
              <div className="print:hidden">
                <MobileBottomNav />
                <OnboardingOverlay />
                <ModuleTourOverlay />
              </div>
              <ProfileSheet />
            </ProfileModalProvider>
          </OnboardingProvider>
        </PermissionsProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
