"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { fetchProfile } from "@/lib/firebase/auth";
import type { Profile } from "@/lib/firebase/types";

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  /** Re-fetches the Firestore profile doc for the current user — call after
   * a self-edit (name, avatar) so the header/sidebar reflect it immediately
   * instead of waiting for the next auth state change (e.g. a reload). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setProfile(firebaseUser ? await fetchProfile(firebaseUser.uid) : null);
      setLoading(false);
    });
  }, []);

  async function refreshProfile() {
    if (user) setProfile(await fetchProfile(user.uid));
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
