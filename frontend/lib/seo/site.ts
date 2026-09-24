/** Identité de l'entreprise pour le référencement — source unique.
 *
 * Tout ce qui décrit Soken's Digital aux moteurs de recherche et aux IA
 * (métadonnées, données structurées JSON-LD, sitemap, llms.txt, images de
 * partage) lit ici. Modifier une information = la modifier à un seul
 * endroit, jamais en double dans chaque page.
 *
 * Adresse postale volontairement absente : pas encore définie (décision du
 * 24/09/2026). Les données structurées n'annoncent que la ville et le pays
 * — une adresse inventée ou approximative serait pire qu'aucune adresse
 * pour Google Business et les moteurs locaux. */

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sokensdigital.com").replace(/\/$/, "");

export const SITE = {
  name: "Soken's Digital",
  legalName: "Soken's Digital",
  shortName: "Soken's",
  tagline: "Excellence digitale sur mesure",
  description:
    "Soken's Digital, agence de développement logiciel et de transformation digitale basée à Libreville (Gabon) : applications web et mobiles, logiciels sur mesure, cloud, cybersécurité et accompagnement des entreprises en Afrique.",
  locale: "fr_FR",
  language: "fr",
  logoPath: "/assets/logo-sokens-digital-blue.png",
  email: "contact@sokensdigital.com",
  // Numéro national gabonais tel que communiqué ; format international à
  // confirmer (voir docs/SEO.md) — utilisé tel quel partout.
  telephoneNational: "060 00 13 33",
  telephone: "+241 060001333",
  rccm: "GA-LBV-01-2026-B12-00774",
  address: {
    locality: "Libreville",
    region: "Estuaire",
    countryCode: "GA",
    countryName: "Gabon",
  },
  // Centre de Libreville — sert au ciblage régional (balises geo.*, schéma
  // LocalBusiness), pas à une adresse précise.
  geo: { latitude: 0.4162, longitude: 9.4673 },
  areaServed: [
    "Gabon",
    "Cameroun",
    "Congo",
    "Guinée équatoriale",
    "Tchad",
    "République centrafricaine",
    "Côte d'Ivoire",
    "Sénégal",
    "Afrique",
  ],
  services: [
    {
      name: "Développement d'applications web et mobiles",
      description: "Conception et développement d'applications web, mobiles et PWA performantes et sécurisées.",
    },
    {
      name: "Logiciels sur mesure",
      description: "Logiciels métiers et ERP adaptés aux processus des entreprises et administrations.",
    },
    {
      name: "Transformation digitale",
      description: "Digitalisation des processus, automatisation et accompagnement au changement.",
    },
    {
      name: "Audit et cybersécurité",
      description: "Audit de sécurité, tests d'intrusion et renforcement des infrastructures.",
    },
    {
      name: "Infrastructure cloud",
      description: "Architecture, migration et hébergement cloud évolutifs et résilients.",
    },
  ],
  keywords: [
    "agence digitale Gabon",
    "développement web Libreville",
    "développement logiciel Gabon",
    "application mobile Gabon",
    "transformation digitale Afrique",
    "cybersécurité Gabon",
    "audit sécurité informatique Libreville",
    "logiciel sur mesure Afrique centrale",
    "ESN Gabon",
    "création site web Libreville",
    "cloud Afrique",
    "digitalisation entreprise Gabon",
  ],
  sameAs: [] as string[],
} as const;

export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
