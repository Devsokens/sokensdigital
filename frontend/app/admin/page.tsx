"use client";

import { useAuth } from "@/lib/auth/auth-context";

export default function AdminDashboardPage() {
  const { profile } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-neutral-900">
        Bonjour {profile?.firstName ?? ""}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Sélectionne un module dans la barre latérale pour commencer.
      </p>
    </div>
  );
}
