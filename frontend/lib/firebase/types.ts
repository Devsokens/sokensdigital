/** Référentiel des rôles 2026 (13) : privilège Super-Admin + 12 rôles
 * fonctionnels. Miroir de backend/core/constants.py. */
export type AppRole =
  | "SUPER_ADMIN"
  | "RESPONSABLE_OPERATIONS"
  | "RESPONSABLE_TECHNIQUE"
  | "RESPONSABLE_MARKETING_COM"
  | "RESPONSABLE_ADMINISTRATIF"
  | "CHEF_DE_PROJET"
  | "DEVELOPPEUR"
  | "COMMERCIAL"
  | "COMPTABLE"
  | "CAISSIER"
  | "SOUS_TRAITANT_DEV"
  | "SOUS_TRAITANT_COMMERCIAL"
  | "SOUS_TRAITANT_DESIGNER";

export const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Super-Administrateur",
  RESPONSABLE_OPERATIONS: "Responsable des Opérations",
  RESPONSABLE_TECHNIQUE: "Responsable Technique",
  RESPONSABLE_MARKETING_COM: "Responsable Marketing & Communication",
  RESPONSABLE_ADMINISTRATIF: "Responsable Administratif",
  CHEF_DE_PROJET: "Chef de Projet",
  DEVELOPPEUR: "Développeur",
  COMMERCIAL: "Commercial",
  COMPTABLE: "Comptable",
  CAISSIER: "Caissier",
  SOUS_TRAITANT_DEV: "Sous-traitant Développeur",
  SOUS_TRAITANT_COMMERCIAL: "Sous-traitant Commercial",
  SOUS_TRAITANT_DESIGNER: "Sous-traitant Designer",
};

/** Plafond de cumul : 2 rôles fonctionnels (le Super-Admin n'est pas compté). */
export const MAX_FUNCTIONAL_ROLES = 2;
export const SUBCONTRACTOR_ROLES: AppRole[] = ["SOUS_TRAITANT_DEV", "SOUS_TRAITANT_COMMERCIAL", "SOUS_TRAITANT_DESIGNER"];

/** Nom Django (français) -> nom applicatif. */
export const DJANGO_ROLE_TO_APP_ROLE: Record<string, AppRole> = {
  "Super-Administrateur": "SUPER_ADMIN",
  "Responsable des Opérations": "RESPONSABLE_OPERATIONS",
  "Responsable Technique": "RESPONSABLE_TECHNIQUE",
  "Responsable Marketing & Communication": "RESPONSABLE_MARKETING_COM",
  "Responsable Administratif": "RESPONSABLE_ADMINISTRATIF",
  "Chef de Projet": "CHEF_DE_PROJET",
  "Développeur": "DEVELOPPEUR",
  "Commercial": "COMMERCIAL",
  "Comptable": "COMPTABLE",
  "Caissier": "CAISSIER",
  "Sous-traitant Développeur": "SOUS_TRAITANT_DEV",
  "Sous-traitant Commercial": "SOUS_TRAITANT_COMMERCIAL",
  "Sous-traitant Designer": "SOUS_TRAITANT_DESIGNER",
};

/** Anciens noms de rôle (profils d'avant le référentiel 2026) -> nouveau. */
const LEGACY_APP_ROLES: Record<string, AppRole | null> = {
  RESPONSABLE_MARKETING: "RESPONSABLE_MARKETING_COM",
  RESPONSABLE_RH: "RESPONSABLE_ADMINISTRATIF",
  ADMINISTRATEUR: "RESPONSABLE_ADMINISTRATIF",
  DIRECTEUR_FINANCIER: "COMPTABLE",
  SUPPORT_CLIENT: "RESPONSABLE_TECHNIQUE",
  CONSULTANT: "RESPONSABLE_TECHNIQUE",
  AUTRE: null,
};

/** Rôles proposés par pôle dans le sélecteur « département → rôle ». */
export const ROLES_BY_DEPARTMENT: Record<string, AppRole[]> = {
  "Direction": ["SUPER_ADMIN", "RESPONSABLE_OPERATIONS"],
  "Administration": ["RESPONSABLE_ADMINISTRATIF"],
  "Comptabilité / Fiscalité": ["COMPTABLE", "CAISSIER"],
  "Techniques": ["RESPONSABLE_TECHNIQUE", "CHEF_DE_PROJET", "DEVELOPPEUR"],
  "Marketing / Communication": ["RESPONSABLE_MARKETING_COM", "COMMERCIAL"],
  "Sous-traitants": ["SOUS_TRAITANT_DEV", "SOUS_TRAITANT_COMMERCIAL", "SOUS_TRAITANT_DESIGNER"],
};

export type ProjectStatus = "ACTIF" | "TERMINE" | "ARCHIVE";

export type RoomType = "COMPANY" | "DEPARTMENT" | "PROJECT" | "DIRECT";

export type LinkedEntityType = "project" | "lead" | "quote";

export type DisbursementStatus =
  | "EN_ATTENTE_RCF"
  | "EN_ATTENTE_GERANT"
  | "APPROUVE"
  | "REJETE"
  | "EXECUTE";

export type VisibilityLevel = "PRIVATE" | "DEPARTMENT" | "COMPANY";

export type NotificationType =
  | "MENTION"
  | "PROJECT_STATUS_CHANGE"
  | "DISBURSEMENT_WAITING"
  | "CONTENT_PUBLISH_REMINDER"
  | "PROJECT_UPDATE"
  | "TASK_ASSIGNED"
  | "TASK_COMMENT"
  | "FOLLOW_UP"
  | "GENERAL";

/** Firestore doc at /notifications/{id} — written server-side only (see
 * firestore.rules and backend/core/firestore_client.py::create_notification),
 * read client-side by the bell in admin-header.tsx. */
export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: NotificationType;
  link: string | null;
  isRead: boolean;
  createdAt: unknown;
}

/** Firestore doc at /profiles/{uid} — id is the Firebase Auth UID.
 *
 * `roles` (plural, décision du 10/09/2026) replaces the old singular `role`
 * — un employé peut cumuler plusieurs rôles applicatifs (ex: Comptable +
 * Caissier). `role` is kept as an optional legacy field: a profile written
 * before this change still only has it, and there's no bulk backfill —
 * always read roles through `profileRoles()` below, never `.role`/`.roles`
 * directly, so both shapes keep working. */
export interface Profile {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  /** @deprecated legacy singular field — use `profileRoles(profile)` */
  role?: AppRole;
  roles?: AppRole[];
  departmentId: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Normalizes a profile's roles regardless of which shape Firestore has for
 * it (see `Profile.roles` doc above). Always use this instead of reading
 * `.role`/`.roles` directly. */
export function profileRoles(profile: Pick<Profile, "roles" | "role"> | null | undefined): AppRole[] {
  if (!profile) return [];
  const raw: string[] = profile.roles && profile.roles.length > 0 ? profile.roles : profile.role ? [profile.role] : [];
  // Profil pas encore aligné sur le référentiel 2026 : anciens noms reclassés.
  const out: AppRole[] = [];
  for (const r of raw) {
    const mapped = r in LEGACY_APP_ROLES ? LEGACY_APP_ROLES[r] : (r as AppRole);
    if (mapped && mapped in ROLE_LABELS && !out.includes(mapped)) out.push(mapped);
  }
  return out;
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
  /** Écrits par le serveur (POST /api/v1/chat/rooms/<id>/read/) : dernier
   * message du salon et « lu jusqu'ici » de chaque membre. */
  lastMessage?: { text: string; authorUid: string; authorName: string; createdAt: unknown; hasAttachment?: boolean } | null;
  readAt?: Record<string, unknown>;
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
  /** `path` : chemin de stockage (lien signé à chaque ouverture) ; `url` :
   * lien initial, seul présent sur les anciens messages. */
  attachment?: { name: string; url: string; path?: string; size: number; contentType: string } | null;
  linkedEntity?: { type: LinkedEntityType; id: string; label: string } | null;
  /** emoji → uids who reacted with it. */
  reactions?: Record<string, string[]>;
  pinned?: boolean;
  pinnedBy?: string | null;
  pinnedAt?: unknown;
}
