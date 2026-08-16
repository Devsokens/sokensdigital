import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
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

export async function markNotificationRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, "notifications", notificationId), { isRead: true });
}
