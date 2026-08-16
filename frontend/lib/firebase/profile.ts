import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Profile } from "@/lib/firebase/types";

export interface ProfileSelfEdit {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

/** Self-service update — only the fields firestore.rules allows a user to
 * touch on their own doc (role/departmentId/email/createdAt stay locked). */
export async function updateOwnProfile(uid: string, data: ProfileSelfEdit) {
  await updateDoc(doc(db, "profiles", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Full profiles list — readable by any signed-in user (basic company
 * directory info, see firestore.rules). uid is the Firebase Auth UID / doc
 * id. Used e.g. by the messaging module's "start a DM" colleague picker. */
export async function listProfiles(): Promise<(Profile & { uid: string })[]> {
  const snapshot = await getDocs(collection(db, "profiles"));
  return snapshot.docs.map((d) => ({ uid: d.id, ...(d.data() as Profile) }));
}
