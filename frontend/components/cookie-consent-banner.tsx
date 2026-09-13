"use client";

import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptAll, getConsent, refuseAll, setConsent } from "@/lib/cookies/consent";

/** Bandeau de gestion des cookies — obligatoire (RGPD/ePrivacy) dès qu'un
 * traceur analytique ou publicitaire est utilisé. S'affiche tant qu'aucun
 * choix n'a été enregistré ; ne dépose donc rien avant que la personne ait
 * explicitement tranché — "Tout refuser" a le même poids visuel que "Tout
 * accepter", pas de dark pattern. Le détail (case par catégorie) reste
 * disponible via "Personnaliser" sans devoir tout accepter pour y accéder. */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytique, setAnalytique] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setVisible(getConsent() === null);
  }, []);

  if (!visible) return null;

  function handleAcceptAll() {
    acceptAll();
    setVisible(false);
  }

  function handleRefuseAll() {
    refuseAll();
    setVisible(false);
  }

  function handleSavePreferences() {
    setConsent({ analytique, marketing });
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0a0e13]/97 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        {!customizing ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:max-w-2xl">
              <Cookie className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                Nous utilisons des cookies pour assurer le fonctionnement du site et, avec votre accord, mesurer
                l&apos;audience. Vous pouvez tout accepter, tout refuser, ou choisir précisément quelles finalités
                autoriser. Voir notre{" "}
                <a href="/confidentialite" className="underline hover:text-primary">
                  politique de confidentialité
                </a>
                .
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setCustomizing(true)}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/5"
              >
                Personnaliser
              </button>
              <button
                type="button"
                onClick={handleRefuseAll}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/5"
              >
                Tout refuser
              </button>
              <Button onClick={handleAcceptAll} className="rounded-full px-4 py-2 text-xs font-semibold">
                Tout accepter
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Paramétrer les cookies</h2>
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                aria-label="Retour"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Nécessaires</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Indispensables au fonctionnement du site (session, préférences). Toujours actifs.
                  </p>
                </div>
                <input type="checkbox" checked disabled className="mt-1 size-4 shrink-0 accent-primary opacity-60" />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Analytiques</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Mesure d&apos;audience anonymisée, pour comprendre l&apos;usage du site.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={analytique}
                  onChange={(e) => setAnalytique(e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] p-3.5">
                <div>
                  <p className="text-sm font-medium text-foreground">Marketing</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Pixels publicitaires pour personnaliser les contenus proposés ailleurs.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2.5">
              <button
                type="button"
                onClick={handleRefuseAll}
                className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-foreground hover:bg-white/5"
              >
                Tout refuser
              </button>
              <Button onClick={handleSavePreferences} className="rounded-full px-4 py-2 text-xs font-semibold">
                Enregistrer mes choix
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
