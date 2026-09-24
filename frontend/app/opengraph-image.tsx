import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/seo/site";

/** Aperçu affiché quand un lien du site est partagé (WhatsApp, Facebook,
 * LinkedIn, X, Slack…) : logo, accroche et localisation, aux couleurs du
 * site. S'applique à toute page qui ne fournit pas sa propre image (un
 * article avec couverture, par exemple). Généré au build, pas à chaque
 * requête. */

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logo = await readFile(path.join(process.cwd(), "public/assets/logo-sokens-digital-white.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0a0e13 0%, #0e1a24 55%, #07303a 100%)",
          color: "#f4f6f8",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" height={72} style={{ objectFit: "contain", alignSelf: "flex-start" }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>
            {SITE.tagline}
          </div>
          <div style={{ marginTop: 24, fontSize: 30, color: "#9fb3c2", lineHeight: 1.35 }}>
            Applications web &amp; mobiles · Logiciels sur mesure · Cloud · Cybersécurité
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", fontSize: 26, color: "#5fd4e0" }}>
          {SITE.address.locality}, {SITE.address.countryName} — au service de l&apos;Afrique
        </div>
      </div>
    ),
    size,
  );
}
