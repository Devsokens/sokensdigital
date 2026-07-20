import { collection, doc, getDocs, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type { Profile } from "@/lib/firebase/types";

export interface ProfileSelfEdit {
  firstName: string;
  lastName: string;
}

/** Self-service update — only the fields firestore.rules allows a user to
 * touch on their own doc (role/departmentId/email/createdAt stay locked). */
export async function updateOwnProfile(uid: string, data: ProfileSelfEdit) {
  await updateDoc(doc(db, "profiles", uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Full profiles list — only readable by SUPER_ADMIN/RESPONSABLE_MARKETING/
 * RESPONSABLE_RH per firestore.rules (the read rule's role check doesn't
 * depend on which doc is being read, so it applies uniformly across a
 * collection query for those roles). uid is the Firebase Auth UID / doc id. */
export async function listProfiles(): Promise<(Profile & { uid: string })[]> {
  const snapshot = await getDocs(collection(db, "profiles"));
  return snapshot.docs.map((d) => ({ uid: d.id, ...(d.data() as Profile) }));
}
