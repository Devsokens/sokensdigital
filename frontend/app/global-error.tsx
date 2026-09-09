"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Dernier filet du App Router : une erreur qui remonte jusqu'ici a cassé le
 * layout racine, donc aucun error boundary de page ne l'a vue. Sans ce
 * fichier, l'utilisateur reçoit l'écran blanc générique de Next et nous
 * n'apprenons rien.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b0f",
          color: "#e8e8ea",
          margin: 0,
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Une erreur est survenue</h1>
          <p style={{ color: "#9a9aa2", marginTop: "0.5rem" }}>
            L&apos;incident a été signalé à l&apos;équipe technique.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "1.5rem",
              padding: "0.6rem 1.4rem",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Recharger la page
          </button>
        </div>
      </body>
    </html>
  );
}
