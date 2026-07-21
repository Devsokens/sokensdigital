import { auth } from "@/lib/firebase/config";

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
