/** Instrumentation navigateur — chargée automatiquement par Next.js. */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, sharedOptions } from "./sentry.shared";

if (SENTRY_DSN) {
  Sentry.init({
    ...sharedOptions,
    // Session Replay volontairement absent : il capturerait à l'écran des
    // montants, des identités et des accès clients. Le gain de diagnostic ne
    // justifie pas d'exfiltrer ça vers un tiers.
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
