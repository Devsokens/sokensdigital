import type { Metadata } from "next";
import { SITE, absoluteUrl } from "@/lib/seo/site";

type PageMetadataInput = {
  title: string | { absolute: string };
  description: string;
  /** Chemin canonique de la page, ex: "/expertise". */
  path: string;
  /** Image de partage spécifique (couverture d'article...) ; à défaut,
   * l'aperçu de marque généré (opengraph-image.tsx) s'applique. */
  image?: string;
  type?: "website" | "article";
  publishedTime?: string;
  keywords?: string[];
};

/** Métadonnées complètes d'une page publique : titre, description,
 * canonique, Open Graph (Facebook, WhatsApp, LinkedIn…) et carte Twitter/X.
 * Le titre passe par le gabarit du layout racine ("%s | Soken's Digital"). */
export function pageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  publishedTime,
  keywords,
}: PageMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const shareTitle = typeof title === "string" ? title : title.absolute;
  // Un `openGraph` défini ici remplace entièrement celui du parent, image
  // générée comprise : sans image propre, on repointe explicitement vers
  // l'aperçu de marque (app/opengraph-image.tsx), sinon le partage du lien
  // s'afficherait sans visuel.
  const images = image
    ? [{ url: absoluteUrl(image), alt: shareTitle }]
    : [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: SITE.name }];
  return {
    title,
    description,
    keywords: keywords ? [...keywords, ...SITE.keywords] : undefined,
    alternates: { canonical: url, languages: { fr: url, "x-default": url } },
    openGraph: {
      type,
      url,
      title: shareTitle,
      description,
      siteName: SITE.name,
      locale: SITE.locale,
      images,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: shareTitle,
      description,
      images: images.map((i) => i.url),
    },
  };
}
