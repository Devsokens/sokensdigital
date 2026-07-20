import {
  signInWithEmailAndPassword,
  signOut,
  type AuthError,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import type { Profile } from "@/lib/firebase/types";

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/invalid-email": "Adresse email invalide.",
  "auth/user-disabled": "Ce compte a été désactivé. Contactez un administrateur.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
};

export function friendlyAuthError(error: unknown): string {
  const code = (error as AuthError)?.code;
  return (code && ERROR_MESSAGES[code]) || "Une erreur est survenue. Réessayez.";
}

export async function signIn(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOutUser() {
  await signOut(auth);
}

/**
 * There is no public self-registration (by design — see
 * docs/backend-specifications.md §3.1, still true after the Firestore
 * pivot). Every account is provisioned by a Super-Admin/RH directly in the
 * Firebase Console (Authentication + a matching /profiles/{uid} document),
 * so a signed-in user with no profile doc yet means "not provisioned",
 * not an error to recover from client-side.
 */
export async function fetchProfile(uid: string): Promise<Profile | null> {
  const snapshot = await getDoc(doc(db, "profiles", uid));
  return snapshot.exists() ? (snapshot.data() as Profile) : null;
}
