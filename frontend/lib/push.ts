import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { firebaseApp } from "@/lib/firebase/config";
import { apiFetch } from "@/lib/api/client";

/**
 * Notifications push navigateur, via Firebase Cloud Messaging.
 *
 * Le jeton identifie un couple (navigateur, appareil) et non un compte : la
 * même personne au bureau, sur son téléphone et sur la PWA installée en a
 * trois, et le backend garde les trois pour que la notification atteigne
 * l'appareil qu'elle a sous les yeux.
 *
 * Tout ici échoue en silence et rend `false` plutôt que de lever. Les
 * notifications sont un confort : un navigateur qui ne les gère pas, un
 * refus de permission ou un service de poussée injoignable ne doit pas
 * empêcher de travailler.
 */

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export type PushPermission = "unsupported" | "granted" | "denied" | "default";

/** Ce que le navigateur autorise aujourd'hui, sans rien demander. */
export async function getPushPermission(): Promise<PushPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  // Sans clé VAPID ni app Firebase (config absente d'un environnement), il
  // n'y a rien à activer : autant le dire que d'échouer plus loin.
  if (!VAPID_KEY || !firebaseApp) return "unsupported";
  if (!(await isSupported().catch(() => false))) return "unsupported";
  return Notification.permission as PushPermission;
}

/** Libellé de l'appareil, pour que l'utilisateur reconnaisse ses appareils
 * dans ses préférences. Volontairement grossier : on veut « Chrome sur
 * Android », pas une empreinte. */
function describeDevice(): string {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Navigateur";
  const platform = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Mac/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : "";
  return platform ? `${browser} sur ${platform}` : browser;
}

function platformCode(): "WEB" | "ANDROID" | "IOS" {
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return "ANDROID";
  if (/iPhone|iPad|iPod/.test(ua)) return "IOS";
  return "WEB";
}

/**
 * Demande l'autorisation si besoin, puis enregistre l'appareil.
 *
 * À n'appeler que sur un geste de l'utilisateur : demander la permission au
 * chargement fait refuser la plupart des gens, et un refus est définitif —
 * le navigateur ne redemandera plus, il faut passer par ses réglages.
 */
export async function enablePush(): Promise<boolean> {
  const state = await getPushPermission();
  if (state === "unsupported" || state === "denied") return false;

  if (state === "default" && (await Notification.requestPermission()) !== "granted") {
    return false;
  }

  try {
    // Le service worker de l'application sert aussi de récepteur push : il
    // écoute déjà `push` et `notificationclick`, inutile d'en enregistrer un
    // second dédié à Firebase.
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(getMessaging(firebaseApp!), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    await apiFetch("/api/v1/core/push/devices/", {
      method: "POST",
      body: JSON.stringify({
        token,
        platform: platformCode(),
        label: describeDevice(),
      }),
    });
    return true;
  } catch (error) {
    console.warn("[push] activation impossible", error);
    return false;
  }
}

/** Retire cet appareil des destinataires, des deux côtés.
 *
 * Le jeton est supprimé côté Firebase *et* côté serveur : n'en faire qu'un
 * laisserait soit des notifications arriver après le retrait, soit un jeton
 * mort réessayé à chaque envoi. */
export async function disablePush(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(firebaseApp!);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) {
      await apiFetch("/api/v1/core/push/devices/", {
        method: "DELETE",
        body: JSON.stringify({ token }),
      }).catch(() => undefined);
      await deleteToken(messaging).catch(() => undefined);
    }
  } catch (error) {
    console.warn("[push] désactivation incomplète", error);
  }
}

/**
 * Rafraîchit l'enregistrement au démarrage, si la permission est déjà
 * accordée.
 *
 * Firebase fait tourner les jetons sans prévenir (réinstallation, nettoyage
 * du navigateur, expiration). Sans ce rappel, un utilisateur ayant accepté il
 * y a des mois cesserait de recevoir ses notifications sans que rien ne le
 * signale, ni à lui ni à nous.
 */
export async function refreshPushRegistration(): Promise<void> {
  if ((await getPushPermission()) !== "granted") return;
  await enablePush();
}
