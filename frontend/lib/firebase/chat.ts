import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  type QuerySnapshot,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { ChatMessage, ChatRoom } from "@/lib/firebase/types";

/** firestore.rules only allows a `list` query whose filters structurally
 * match the read rule for that roomType (broad unfiltered queries against
 * chatRooms are rejected), so rooms must be fetched via three separate
 * targeted queries rather than one collection-wide listener. */
export function subscribeToRooms(
  { departmentId, uid }: { departmentId: string | null; uid: string },
  onChange: (rooms: ChatRoom[]) => void
): Unsubscribe {
  const rooms = new Map<string, ChatRoom>();
  const emit = () => onChange(Array.from(rooms.values()));

  const unsubscribers: Unsubscribe[] = [];

  const companyQuery = query(collection(db, "chatRooms"), where("roomType", "==", "COMPANY"));
  unsubscribers.push(
    onSnapshot(companyQuery, (snapshot) => {
      applySnapshot(rooms, "COMPANY", snapshot);
      emit();
    })
  );

  if (departmentId) {
    const departmentQuery = query(
      collection(db, "chatRooms"),
      where("roomType", "==", "DEPARTMENT"),
      where("departmentId", "==", departmentId)
    );
    unsubscribers.push(
      onSnapshot(departmentQuery, (snapshot) => {
        applySnapshot(rooms, "DEPARTMENT", snapshot);
        emit();
      })
    );
  }

  const projectQuery = query(
    collection(db, "chatRooms"),
    where("roomType", "==", "PROJECT"),
    where("memberUids", "array-contains", uid)
  );
  unsubscribers.push(
    onSnapshot(projectQuery, (snapshot) => {
      applySnapshot(rooms, "PROJECT", snapshot);
      emit();
    })
  );

  return () => unsubscribers.forEach((unsub) => unsub());
}

function applySnapshot(
  rooms: Map<string, ChatRoom>,
  roomType: ChatRoom["roomType"],
  snapshot: QuerySnapshot<DocumentData>
) {
  for (const [id, room] of rooms) {
    if (room.roomType === roomType) rooms.delete(id);
  }
  for (const docSnap of snapshot.docs) {
    rooms.set(docSnap.id, { id: docSnap.id, ...(docSnap.data() as Omit<ChatRoom, "id">) });
  }
}

export function subscribeToMessages(
  roomId: string,
  onChange: (messages: ChatMessage[]) => void
): Unsubscribe {
  const messagesQuery = query(
    collection(db, "chatRooms", roomId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(messagesQuery, (snapshot) => {
    onChange(
      snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }))
    );
  });
}

export async function sendMessage(
  roomId: string,
  { text, authorUid, authorName }: { text: string; authorUid: string; authorName: string }
) {
  await addDoc(collection(db, "chatRooms", roomId, "messages"), {
    text,
    authorUid,
    authorName,
    createdAt: serverTimestamp(),
  });
}
