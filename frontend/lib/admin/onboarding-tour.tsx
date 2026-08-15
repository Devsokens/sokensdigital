"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";

export interface OnboardingStep {
  /** Matches a `data-tour="{id}"` attribute somewhere in the admin chrome. */
  id: string;
  title: string;
  description: string;
  placement: "right" | "bottom-start" | "bottom-end";
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "sidebar-nav",
    title: "Vos modules",
    description:
      "Tous les modules de l'application sont regroupés ici par département. Cliquez sur un module pour y accéder.",
    placement: "right",
  },
  {
    id: "department-switcher",
    title: "Les départements",
    description:
      "Chaque icône représente un département. Cliquez-en un pour n'afficher que ses modules dans le menu à côté.",
    placement: "right",
  },
  {
    id: "search",
    title: "Recherche rapide",
    description: "Retrouvez instantanément une page, un lead, un devis ou un employé — raccourci ⌘ /.",
    placement: "bottom-start",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Les alertes et mentions qui vous concernent apparaissent ici.",
    placement: "bottom-end",
  },
  {
    id: "profile",
    title: "Votre profil",
    description: "Accédez à votre profil, votre rôle et à la déconnexion.",
    placement: "bottom-end",
  },
];

interface OnboardingContextValue {
  active: boolean;
  stepIndex: number;
  step: OnboardingStep | null;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function storageKey(uid: string) {
  return `sd-admin-onboarding-seen:${uid}`;
}

/** First-login product tour over the admin chrome (sidebar, department
 * switcher, search, notifications, profile). Fires once per Firebase user —
 * tracked in localStorage rather than the Firestore profile doc, since it's
 * a purely local UI preference, not data other parts of the app need to
 * read. Replayable any time via the "?" button in the header. */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const finish = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    if (user) localStorage.setItem(storageKey(user.uid), "1");
  }, [user]);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    setStepIndex((index) => {
      if (index + 1 >= ONBOARDING_STEPS.length) {
        finish();
        return index;
      }
      return index + 1;
    });
  }, [finish]);

  const prev = useCallback(() => {
    setStepIndex((index) => Math.max(0, index - 1));
  }, []);

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (localStorage.getItem(storageKey(user.uid))) return;
    // Give the chrome a moment to lay out before measuring targets.
    const timeout = setTimeout(() => start(), 500);
    return () => clearTimeout(timeout);
  }, [loading, user, profile, start]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      active,
      stepIndex,
      step: active ? ONBOARDING_STEPS[stepIndex] : null,
      start,
      next,
      prev,
      skip: finish,
    }),
    [active, stepIndex, start, next, prev, finish]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboardingTour() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboardingTour must be used within an OnboardingProvider");
  return ctx;
}
