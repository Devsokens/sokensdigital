import { auth } from "@/lib/firebase/config";
import { apiFetch } from "@/lib/api/client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Separate from apiFetch() on purpose — that helper always forces
 * Content-Type: application/json, which breaks multipart uploads (the
 * browser needs to set its own Content-Type with a boundary for
 * FormData, which only happens if we don't set one ourselves). */
export async function uploadImage(file: File): Promise<string> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/marketing/cms/upload-image/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let detail = `Échec de l'upload (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      // no JSON body
    }
    throw new Error(detail);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

/** Same reasoning as uploadImage() — raw fetch, not apiFetch(), for the
 * multipart body. 25 Mo max, video content-types only (core.storage). */
export async function uploadVideo(file: File): Promise<string> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/marketing/cms/upload-video/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let detail = `Échec de l'upload (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      // no JSON body
    }
    throw new Error(detail);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

async function uploadToEndpoint(path: string, file: File): Promise<string> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    let detail = `Échec de l'upload (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      // no JSON body
    }
    throw new Error(detail);
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

/** Any authenticated user — used by the profile sheet's avatar picker.
 * Resized/recompressed server-side, 5 Mo max (core.storage). */
export function uploadAvatar(file: File): Promise<string> {
  return uploadToEndpoint("/api/v1/uploads/avatar/", file);
}

/** Any authenticated user — used by the messaging composer's attach
 * button. No type restriction, 20 Mo max (core.storage). */
export function uploadChatFile(file: File): Promise<string> {
  return uploadToEndpoint("/api/v1/uploads/chat-attachment/", file);
}

/** Pièce jointe rangée dans le dossier du salon : renvoie son chemin
 * (stocké dans le message) et un premier lien. */
export async function uploadChatFileToRoom(file: File, roomId: string): Promise<{ url: string; path: string }> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("room", roomId);
  const response = await fetch(`${API_BASE_URL}/api/v1/uploads/chat-attachment/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!response.ok) {
    let detail = `Échec de l'upload (${response.status})`;
    try {
      const body = await response.json();
      if (body.detail) detail = body.detail;
    } catch {
      // no JSON body
    }
    throw new Error(detail);
  }
  return (await response.json()) as { url: string; path: string };
}

/** Lien frais vers la pièce jointe d'un message (membres du salon). */
export async function getChatAttachmentLink(roomId: string, messageId: string): Promise<string> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;
  const qs = new URLSearchParams({ room: roomId, message: messageId });
  const response = await fetch(`${API_BASE_URL}/api/v1/uploads/chat-attachment/link/?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error("Fichier indisponible.");
  return ((await response.json()) as { url: string }).url;
}

/** Ouvre la pièce jointe dans un nouvel onglet avec un lien frais. L'onglet
 * est ouvert tout de suite (sinon bloqué comme pop-up), puis redirigé. */
export async function openChatAttachment(roomId: string, messageId: string) {
  const tab = window.open("", "_blank");
  try {
    const url = await getChatAttachmentLink(roomId, messageId);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch {
    tab?.close();
    alert("Ce fichier n'est pas disponible.");
  }
}


/** Crée au besoin les salons entreprise / département de l'utilisateur. */
export function ensureChatRooms() {
  return apiFetch<{ department_id: string | null }>("/api/v1/chat/rooms/ensure/", { method: "POST" });
}

/** Salon lu par l'utilisateur + aperçu du dernier message (côté serveur). */
export function markChatRoomRead(roomId: string, options?: { sent?: boolean }) {
  return apiFetch<void>(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/read/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // sent : après un envoi, le serveur notifie les autres membres (in-app + push).
    body: JSON.stringify(options?.sent ? { sent: true } : {}),
  });
}
