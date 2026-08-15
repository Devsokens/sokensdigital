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

export type RoomType = "COMPANY" | "DEPARTMENT" | "PROJECT" | "DIRECT";

export type LinkedEntityType = "project" | "lead" | "quote";

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
  avatarUrl?: string | null;
  role: AppRole;
  departmentId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Firestore doc at /chatRooms/{roomId}. COMPANY/DEPARTMENT/PROJECT rooms
 * are mirrored from Django (Admin SDK); DIRECT rooms are created
 * client-side by whichever user starts the conversation — see
 * lib/firebase/chat.ts and firestore.rules. */
export interface ChatRoom {
  id: string;
  name: string;
  roomType: RoomType;
  departmentId?: string | null;
  projectId?: string | null;
  memberUids?: string[];
  /** DIRECT rooms only — uid → display name, denormalized at creation time
   * since a regular employee can't read a colleague's /profiles doc. */
  participantNames?: Record<string, string>;
  isActive: boolean;
  createdAt: unknown;
}

/** Firestore doc at /chatRooms/{roomId}/messages/{messageId}. Content
 * fields (text/author/attachment/...) are immutable once created —
 * firestore.rules only allows updates that touch reactions/pinned fields,
 * never the message body itself. */
export interface ChatMessage {
  id: string;
  text: string;
  authorUid: string;
  authorName: string;
  createdAt: unknown;
  /** Set when this message is a thread reply. */
  parentMessageId?: string | null;
  attachment?: { name: string; url: string; size: number; contentType: string } | null;
  linkedEntity?: { type: LinkedEntityType; id: string; label: string } | null;
  /** emoji → uids who reacted with it. */
  reactions?: Record<string, string[]>;
  pinned?: boolean;
  pinnedBy?: string | null;
  pinnedAt?: unknown;
}
