"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface ProfileModalValue {
  open: boolean;
  openProfileModal: () => void;
  closeProfileModal: () => void;
}

const ProfileModalContext = createContext<ProfileModalValue | null>(null);

export function ProfileModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(
    () => ({ open, openProfileModal: () => setOpen(true), closeProfileModal: () => setOpen(false) }),
    [open]
  );
  return <ProfileModalContext.Provider value={value}>{children}</ProfileModalContext.Provider>;
}

export function useProfileModal() {
  const ctx = useContext(ProfileModalContext);
  if (!ctx) throw new Error("useProfileModal must be used within a ProfileModalProvider");
  return ctx;
}
