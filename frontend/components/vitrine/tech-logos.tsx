/* Logos des technologies fournis avec le site (public/assets/tech), retrouvés
 * par nom quand un élément du CMS n'a pas de logo envoyé. */

const TECH_LOGOS: Record<string, string> = {
  "next.js": "/assets/tech/nextjs.svg",
  nextjs: "/assets/tech/nextjs.svg",
  python: "/assets/tech/python.svg",
  django: "/assets/tech/django.svg",
  postgresql: "/assets/tech/postgresql.svg",
  postgres: "/assets/tech/postgresql.svg",
  docker: "/assets/tech/docker.svg",
  aws: "/assets/tech/aws.svg",
  "amazon web services": "/assets/tech/aws.svg",
  redis: "/assets/tech/redis.svg",
};

export function techLogo(name: string, uploaded = "") {
  return uploaded || TECH_LOGOS[name.trim().toLowerCase()] || "";
}

/** Logo d'une technologie (image du CMS ou logo fourni), ou rien. */
export function TechLogo({ src, size }: { src: string; size: number }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{ display: "block", width: `${size}px`, height: `${size}px`, objectFit: "contain", flex: "none" }} />;
}
