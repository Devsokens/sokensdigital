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
