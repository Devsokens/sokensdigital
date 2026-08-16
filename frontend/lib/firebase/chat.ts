import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QuerySnapshot,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { uploadChatFile } from "@/lib/api/upload";
import type { ChatMessage, ChatRoom, LinkedEntityType } from "@/lib/firebase/types";

/** firestore.rules only allows a `list` query whose filters structurally
 * match the read rule for that roomType (broad unfiltered queries against
 * chatRooms are rejected), so rooms must be fetched via separate targeted
 * queries rather than one collection-wide listener. */
export function subscribeToRooms(
  { departmentId, uid }: { departmentId: string | null; uid: string },
  onChange: (rooms: ChatRoom[]) => void
): Unsubscribe {
  const rooms = new Map<string, ChatRoom>();
  const emit = () => onChange(Array.from(rooms.values()));

  const unsubscribers: Unsubscribe[] = [];

  // Named onError handlers — without one, the Firebase SDK swallows the
  // failing query into a single generic "Uncaught Error in snapshot
  // listener" with no indication of *which* of the 4 queries below it
  // came from, which made a real permission-denied bug impossible to
  // localize from the browser console alone.
  function onError(label: string) {
    return (err: Error) => console.error(`[chat] subscribeToRooms(${label}) failed:`, err);
  }

  const companyQuery = query(collection(db, "chatRooms"), where("roomType", "==", "COMPANY"));
  unsubscribers.push(
    onSnapshot(
      companyQuery,
      (snapshot) => {
        applySnapshot(rooms, "COMPANY", snapshot);
        emit();
      },
      onError("COMPANY")
    )
  );

  if (departmentId) {
    const departmentQuery = query(
      collection(db, "chatRooms"),
      where("roomType", "==", "DEPARTMENT"),
      where("departmentId", "==", departmentId)
    );
    unsubscribers.push(
      onSnapshot(
        departmentQuery,
        (snapshot) => {
          applySnapshot(rooms, "DEPARTMENT", snapshot);
          emit();
        },
        onError("DEPARTMENT")
      )
    );
  }

  const projectQuery = query(
    collection(db, "chatRooms"),
    where("roomType", "==", "PROJECT"),
    where("memberUids", "array-contains", uid)
  );
  unsubscribers.push(
    onSnapshot(
      projectQuery,
      (snapshot) => {
        applySnapshot(rooms, "PROJECT", snapshot);
        emit();
      },
      onError("PROJECT")
    )
  );

  const directQuery = query(
    collection(db, "chatRooms"),
    where("roomType", "==", "DIRECT"),
    where("memberUids", "array-contains", uid)
  );
  unsubscribers.push(
    onSnapshot(
      directQuery,
      (snapshot) => {
        applySnapshot(rooms, "DIRECT", snapshot);
        emit();
      },
      onError("DIRECT")
    )
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

/** Deterministic id so starting a DM with the same colleague twice reuses
 * the same room instead of creating duplicates. */
function directRoomId(uidA: string, uidB: string) {
  return `dm_${[uidA, uidB].sort().join("_")}`;
}

/** Names are denormalized onto the room doc at creation time — a regular
 * employee can't read a colleague's /profiles doc (see firestore.rules),
 * so this is the only way both participants can display each other's name. */
export async function getOrCreateDirectRoom(
  me: { uid: string; name: string },
  other: { uid: string; name: string }
): Promise<string> {
  const id = directRoomId(me.uid, other.uid);
  const roomRef = doc(db, "chatRooms", id);
  const existing = await getDoc(roomRef);
  if (!existing.exists()) {
    await setDoc(roomRef, {
      name: "",
      roomType: "DIRECT",
      memberUids: [me.uid, other.uid],
      participantNames: { [me.uid]: me.name, [other.uid]: other.name },
      isActive: true,
      createdAt: serverTimestamp(),
    });
  }
  return id;
}

export function subscribeToMessages(
  roomId: string,
  onChange: (messages: ChatMessage[]) => void
): Unsubscribe {
  const messagesQuery = query(
    collection(db, "chatRooms", roomId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ChatMessage, "id">) }))
      );
    },
    (err) => console.error(`[chat] subscribeToMessages(${roomId}) failed:`, err)
  );
}

export async function sendMessage(
  roomId: string,
  {
    text,
    authorUid,
    authorName,
    parentMessageId,
    attachment,
    linkedEntity,
  }: {
    text: string;
    authorUid: string;
    authorName: string;
    parentMessageId?: string | null;
    attachment?: ChatMessage["attachment"];
    linkedEntity?: { type: LinkedEntityType; id: string; label: string } | null;
  }
) {
  await addDoc(collection(db, "chatRooms", roomId, "messages"), {
    text,
    authorUid,
    authorName,
    createdAt: serverTimestamp(),
    parentMessageId: parentMessageId ?? null,
    attachment: attachment ?? null,
    linkedEntity: linkedEntity ?? null,
    reactions: {},
    pinned: false,
  });
}

/** Uploads a chat attachment (via Django → Supabase Storage, see
 * lib/api/upload's uploadChatFile) and returns the fields to pass as
 * `attachment` on sendMessage — kept as two steps (rather than doing it
 * inside sendMessage) so the UI can show upload progress before the
 * message actually appears in the thread. */
export async function uploadChatAttachment(file: File): Promise<ChatMessage["attachment"]> {
  const url = await uploadChatFile(file);
  return { name: file.name, url, size: file.size, contentType: file.type };
}

export async function toggleReaction(
  roomId: string,
  messageId: string,
  emoji: string,
  uid: string,
  alreadyReacted: boolean
) {
  const messageRef = doc(db, "chatRooms", roomId, "messages", messageId);
  await updateDoc(messageRef, {
    [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(uid) : arrayUnion(uid),
  });
}

export async function togglePinned(
  roomId: string,
  messageId: string,
  pinned: boolean,
  uid: string
) {
  const messageRef = doc(db, "chatRooms", roomId, "messages", messageId);
  await updateDoc(messageRef, {
    pinned,
    pinnedBy: pinned ? uid : null,
    pinnedAt: pinned ? serverTimestamp() : null,
  });
}
