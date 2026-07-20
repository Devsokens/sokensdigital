import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { RequireAuth } from "@/components/auth/require-auth";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata: Metadata = {
  title: "Mon profil — Soken's Digital",
};

export default function ProfilPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col px-6 pt-32 pb-24">
        <RequireAuth>
          <ProfileForm />
        </RequireAuth>
      </main>
      <SiteFooter />
    </>
  );
}
