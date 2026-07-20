export type AppRole =
  | "SUPER_ADMIN"
  | "RESPONSABLE_MARKETING"
  | "RESPONSABLE_RH"
  | "COMMERCIAL"
  | "CHEF_DE_PROJET"
  | "DEVELOPPEUR"
  | "COMPTABLE"
  | "DIRECTEUR_FINANCIER"
  | "AUTRE";

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Super-Administrateur",
  RESPONSABLE_MARKETING: "Responsable Marketing",
  RESPONSABLE_RH: "Responsable RH",
  COMMERCIAL: "Commercial",
  CHEF_DE_PROJET: "Chef de Projet",
  DEVELOPPEUR: "Développeur",
  COMPTABLE: "Comptable",
  DIRECTEUR_FINANCIER: "Directeur Financier",
  AUTRE: "Autre",
};

export type ProjectStatus = "ACTIF" | "TERMINE" | "ARCHIVE";

export type RoomType = "COMPANY" | "DEPARTMENT" | "PROJECT";

export type DisbursementStatus =
  | "EN_ATTENTE_N1"
  | "EN_ATTENTE_N2"
  | "EN_ATTENTE_N3"
  | "APPROUVE"
  | "REJETE"
  | "EXECUTE";

export type VisibilityLevel = "PRIVATE" | "DEPARTMENT" | "COMPANY";

export type NotificationType =
  | "MENTION"
  | "PROJECT_STATUS_CHANGE"
  | "DISBURSEMENT_WAITING";

/** Firestore doc at /profiles/{uid} — id is the Firebase Auth UID. */
export interface Profile {
  email: string;
  firstName: string;
  lastName: string;
  role: AppRole;
  departmentId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Firestore doc at /chatRooms/{roomId} — mirrored from Django
 * (Department/Project) via the Admin SDK, or created once for the single
 * COMPANY room (`manage.py create_company_room`). See firestore.rules. */
export interface ChatRoom {
  id: string;
  name: string;
  roomType: RoomType;
  departmentId?: string | null;
  projectId?: string | null;
  memberUids?: string[];
  isActive: boolean;
  createdAt: unknown;
}

/** Firestore doc at /chatRooms/{roomId}/messages/{messageId}. Immutable —
 * firestore.rules disallows update/delete on this subcollection. */
export interface ChatMessage {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  createdAt: unknown;
}
