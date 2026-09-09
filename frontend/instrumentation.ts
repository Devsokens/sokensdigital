/** Point d'entrée serveur/edge de l'instrumentation Next.js. */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, sharedOptions } from "./sentry.shared";

export async function register() {
  if (!SENTRY_DSN) return;
  Sentry.init(sharedOptions);
}

export const onRequestError = Sentry.captureRequestError;
