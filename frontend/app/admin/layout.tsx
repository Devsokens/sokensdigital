import { AuthProvider } from "@/lib/auth/auth-context";
import { RequireAuth } from "@/components/auth/require-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { OnboardingProvider } from "@/lib/admin/onboarding-tour";
import { OnboardingOverlay } from "@/components/admin/onboarding-overlay";
import { ModuleTourOverlay } from "@/components/admin/module-tour-overlay";
import { MobileBottomNav } from "@/components/admin/mobile-bottom-nav";
import { ProfileModalProvider } from "@/lib/admin/profile-modal-context";
import { ProfileSheet } from "@/components/profile/profile-sheet";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <RequireAuth>
        <OnboardingProvider>
          <ProfileModalProvider>
            <AdminShell>{children}</AdminShell>
            <div className="print:hidden">
              <MobileBottomNav />
              <OnboardingOverlay />
              <ModuleTourOverlay />
            </div>
            <ProfileSheet />
          </ProfileModalProvider>
        </OnboardingProvider>
      </RequireAuth>
    </AuthProvider>
  );
}
