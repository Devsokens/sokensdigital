"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useOnboardingTour } from "@/lib/admin/onboarding-tour";
import { findModuleTour } from "@/lib/admin/module-tours";
import { useTargetRect } from "@/lib/admin/use-target-rect";
import { SpotlightOverlay } from "@/components/admin/spotlight-overlay";

function storageKey(uid: string) {
  return `sd-admin-module-tours-seen:${uid}`;
}

function getSeen(uid: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(uid)) ?? "{}");
  } catch {
    return {};
  }
}

function markSeen(uid: string, key: string) {
  const seen = getSeen(uid);
  seen[key] = true;
  localStorage.setItem(storageKey(uid), JSON.stringify(seen));
}

/** One-shot spotlight per module page — the "chrome" tour (OnboardingOverlay)
 * teaches the shell once; this teaches each module's key action the first
 * time a user actually opens it. Deferred while the chrome tour is active so
 * the two never overlap. */
export function ModuleTourOverlay() {
  const pathname = usePathname();
  const { user, profile, loading } = useAuth();
  const { active: chromeTourActive } = useOnboardingTour();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  const entry = findModuleTour(pathname);
  const alreadySeen = entry && user ? getSeen(user.uid)[entry.key] : true;
  const shouldShow =
    !loading && !!user && !!profile && !chromeTourActive && !!entry && !alreadySeen && !dismissed.has(entry.key);

  const rect = useTargetRect(shouldShow ? entry?.key : undefined);

  if (!shouldShow || !entry) return null;
  const activeEntry = entry;

  function dismiss() {
    if (user) markSeen(user.uid, activeEntry.key);
    setDismissed((prev) => new Set(prev).add(activeEntry.key));
  }

  return (
    <SpotlightOverlay
      rect={rect}
      placement={activeEntry.placement}
      title={activeEntry.title}
      description={activeEntry.description}
      tooltipKey={activeEntry.key}
      onDismiss={dismiss}
      footer={
        <div className="flex justify-end">
          <button
            onClick={dismiss}
            className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
          >
            Compris
          </button>
        </div>
      }
    />
  );
}
