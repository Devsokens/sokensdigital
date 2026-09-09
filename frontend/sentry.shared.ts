/**
 * Options Sentry communes au client, au serveur et à l'edge runtime.
 *
 * Tout est conditionné à NEXT_PUBLIC_SENTRY_DSN : sans DSN (dev, CI), le SDK
 * n'est pas initialisé du tout — pas de requête réseau, pas de surcoût.
 */
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

export const sharedOptions = {
  dsn: SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? "production",
  // Les écrans manipulent des données comptables et RH nominatives : on
  // n'envoie ni corps de requête, ni cookies, ni adresse IP.
  sendDefaultPii: false,
  // 10 % : assez pour repérer les pages lentes sans saturer le quota.
  tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
  // Le service worker sert /offline quand le réseau tombe. Une coupure n'est
  // pas un bug applicatif : la remonter noierait les vraies erreurs.
  ignoreErrors: ["Failed to fetch", "NetworkError", "Load failed"],
};
