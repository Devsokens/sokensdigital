import { SITE, SITE_URL, absoluteUrl } from "@/lib/seo/site";

/** Données structurées schema.org (JSON-LD) — lues par Google (résultats
 * enrichis, panneau d'entreprise, recherche locale), Bing et les moteurs
 * d'IA pour comprendre qui est l'entreprise, où elle opère et ce qu'elle
 * propose, sans deviner à partir de la mise en page. */

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    "@id": ORG_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(SITE.logoPath),
    },
    image: absoluteUrl(SITE.logoPath),
    description: SITE.description,
    email: SITE.email,
    telephone: SITE.telephone,
    identifier: {
      "@type": "PropertyValue",
      propertyID: "RCCM",
      value: SITE.rccm,
    },
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.address.locality,
      addressRegion: SITE.address.region,
      addressCountry: SITE.address.countryCode,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: SITE.geo.latitude,
      longitude: SITE.geo.longitude,
    },
    areaServed: SITE.areaServed.map((name) => ({ "@type": "Place", name })),
    knowsLanguage: ["fr"],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: SITE.telephone,
        email: SITE.email,
        areaServed: "Africa",
        availableLanguage: ["French"],
      },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: SITE.services.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.name,
          description: service.description,
          provider: { "@id": ORG_ID },
          areaServed: "Africa",
        },
      })),
    },
    ...(SITE.sameAs.length ? { sameAs: SITE.sameAs } : {}),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE.name,
    description: SITE.description,
    inLanguage: "fr",
    publisher: { "@id": ORG_ID },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function articleSchema(input: {
  title: string;
  description: string;
  path: string;
  image?: string;
  author?: string;
  publishedAt?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    mainEntityOfPage: absoluteUrl(input.path),
    inLanguage: "fr",
    ...(input.image ? { image: [absoluteUrl(input.image)] } : {}),
    ...(input.publishedAt ? { datePublished: input.publishedAt, dateModified: input.publishedAt } : {}),
    author: input.author
      ? { "@type": "Person", name: input.author }
      : { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
}

export function projectSchema(input: { title: string; description: string; path: string; image?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: input.title,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: "fr",
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
    creator: { "@id": ORG_ID },
  };
}

export function faqSchema(entries: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}
