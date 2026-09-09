import { auth } from "@/lib/firebase/config";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/**
 * Requêtes GET identiques déjà en vol.
 *
 * Plusieurs panneaux d'un même écran demandent souvent la même liste au
 * même instant (l'onglet Achats charge `listProcurementRequests` depuis
 * deux endroits, React 18 monte les effets deux fois en StrictMode...).
 * Sans déduplication, chacune part sur le réseau : sur une connexion
 * irrégulière, c'est la latence multipliée pour rien.
 *
 * On ne garde QUE les requêtes en cours, pas leur résultat : dès qu'une
 * réponse est arrivée, l'entrée disparaît. Ce n'est donc pas un cache — il
 * n'y a aucun risque de servir un solde ou un statut périmé, ce qui serait
 * inacceptable sur des écrans comptables.
 */
const inFlight = new Map<string, Promise<unknown>>();

async function performFetch<T>(path: string, init: RequestInit): Promise<T> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // no JSON body
    }
    throw new ApiError(response.status, body, `API ${path} failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** Thin fetch wrapper for the Django API — attaches the current Firebase
 * ID token as a Bearer header, since core.authentication.FirebaseAuthentication
 * verifies it server-side on every request. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();

  // Les écritures ne sont jamais dédupliquées : deux POST identiques sont
  // deux intentions distinctes (deux versements du même montant, par
  // exemple), les fusionner serait une perte de données.
  if (method !== "GET") {
    return performFetch<T>(path, init);
  }

  const existing = inFlight.get(path);
  if (existing) return existing as Promise<T>;

  const request = performFetch<T>(path, init).finally(() => {
    inFlight.delete(path);
  });
  inFlight.set(path, request);
  return request;
}
