import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

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
