import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Notification } from "@/lib/firebase/types";

const RECENT_NOTIFICATIONS_LIMIT = 30;

/** Notifications are written server-side only (firestore.rules: `allow
 * create, delete: if false`) — see backend/core/firestore_client.py's
 * create_notification(). This is a read + mark-as-read client. */
export function subscribeToNotifications(
  uid: string,
  onChange: (notifications: Notification[]) => void
): Unsubscribe {
  const notificationsQuery = query(
    collection(db, "notifications"),
    where("recipientId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(RECENT_NOTIFICATIONS_LIMIT)
  );
  return onSnapshot(
    notificationsQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Notification, "id">) }))
      );
    },
    (err) => console.error("[notifications] subscribeToNotifications failed:", err)
  );
}

async function notificationsApi(path: string, body?: unknown) {
  const { auth } = await import("@/lib/firebase/config");
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const response = await fetch(`${base}/api/v1/notifications/${path}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  });
  if (!response.ok) throw new Error("Action sur les notifications impossible.");
  return response.json();
}

/** Marquage « lu » via le serveur (Admin SDK) : fiable quelles que soient
 * les règles Firestore déployées. */
export async function markNotificationRead(notificationId: string): Promise<void> {
  await notificationsApi("mark-read", { ids: [notificationId] });
}

export async function markAllNotificationsRead(): Promise<void> {
  await notificationsApi("mark-read");
}

/** Efface les notifications déjà lues de l'utilisateur connecté. */
export async function clearReadNotifications(): Promise<number> {
  const data = (await notificationsApi("clear-read")) as { deleted: number };
  return data.deleted;
}
