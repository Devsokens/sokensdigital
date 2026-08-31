/*
 * Service worker — Soken's Digital
 *
 * Objectif : que l'application reste utilisable sur une connexion
 * irrégulière (3G qui tombe, tunnel, wifi saturé), sans jamais servir de
 * données financières périmées comme si elles étaient fraîches.
 *
 * D'où trois stratégies distinctes plutôt qu'un cache global :
 *
 *  1. Coque applicative (JS/CSS/polices/images) — "stale-while-revalidate".
 *     Ces fichiers portent un hash dans leur nom : une version en cache est
 *     par construction la bonne version. On sert immédiatement et on
 *     rafraîchit en arrière-plan.
 *
 *  2. Navigations (documents HTML) — "network-first" avec repli sur la
 *     page hors-ligne. On veut la dernière version de l'app ; si le réseau
 *     manque, on affiche une page qui l'explique plutôt qu'une erreur brute
 *     du navigateur.
 *
 *  3. Appels API — "network-first" avec repli sur le dernier succès, et
 *     un en-tête `X-From-Cache` sur la réponse de repli pour que l'UI
 *     puisse signaler que la donnée n'est pas fraîche. JAMAIS de
 *     cache-first ici : afficher un solde de trésorerie d'hier sans le dire
 *     serait pire que ne rien afficher.
 *     Les écritures (POST/PATCH/DELETE) ne sont jamais mises en cache ni
 *     rejouées : une double validation de facture provoquée par un rejeu
 *     silencieux serait un incident comptable.
 */

const VERSION = "v1";
const SHELL_CACHE = `sokens-shell-${VERSION}`;
const API_CACHE = `sokens-api-${VERSION}`;
const OFFLINE_URL = "/offline";

// Pré-cache minimal : la page hors-ligne doit être disponible même au tout
// premier passage en tunnel, donc avant toute visite de sa part.
const PRECACHE_URLS = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      // Un pré-cache qui échoue (asset renommé, réseau coupé pendant
      // l'installation) ne doit pas empêcher le SW de s'installer : sans ce
      // catch, l'utilisateur reste sans service worker du tout.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("sokens-") && !key.endsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isApiRequest(url) {
  return url.pathname.startsWith("/api/");
}

function isShellAsset(request, url) {
  return (
    url.origin === self.location.origin &&
    (request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "font" ||
      request.destination === "image" ||
      url.pathname.startsWith("/_next/static/"))
  );
}

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (!cached) throw error;
    // On marque explicitement la réponse : c'est à l'interface de dire à
    // l'utilisateur que ces chiffres datent de la dernière connexion.
    const headers = new Headers(cached.headers);
    headers.set("X-From-Cache", "1");
    return new Response(cached.body, {
      status: cached.status,
      statusText: cached.statusText,
      headers,
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(SHELL_CACHE);
    return (await cache.match(request)) || (await cache.match(OFFLINE_URL)) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // écritures : jamais interceptées

  const url = new URL(request.url);

  // Firebase Auth / Firestore gèrent leur propre persistance et leurs
  // propres reprises : s'interposer casserait leur logique de session.
  if (url.origin !== self.location.origin && !isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }
  if (isApiRequest(url)) {
    event.respondWith(networkFirstApi(request));
    return;
  }
  if (isShellAsset(request, url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
