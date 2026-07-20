import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// This module is imported by "use client" components (auth-context.tsx),
// but Next.js still evaluates the client module graph on the SERVER during
// static generation (e.g. the auto-generated /_not-found page) — so this
// top-level code runs there too. If NEXT_PUBLIC_FIREBASE_* isn't resolvable
// in that pass, `getAuth()` throws `auth/invalid-api-key` immediately and
// takes the entire build down with it, including pages that never touch
// auth. Guard so a misconfigured/absent env var degrades to "no Firebase"
// instead of a hard build failure — real browser usage (where the vars are
// always present via next build's NEXT_PUBLIC_ inlining) is unaffected.
const hasConfig = Boolean(firebaseConfig.apiKey);

export const firebaseApp: FirebaseApp | undefined = hasConfig
  ? getApps().length
    ? getApps()[0]
    : initializeApp(firebaseConfig)
  : undefined;

export const auth = (firebaseApp ? getAuth(firebaseApp) : undefined) as Auth;
export const db = (firebaseApp ? getFirestore(firebaseApp) : undefined) as Firestore;
