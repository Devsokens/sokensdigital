import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { PublicChatWidgetGate } from "@/components/public-chat-widget-gate";
import { CookieConsentGate } from "@/components/cookie-consent-gate";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
import { JsonLd } from "@/components/seo/json-ld";
import { SITE, SITE_URL } from "@/lib/seo/site";
import { organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Base de toutes les URL absolues (canonique, Open Graph, images) — sans
  // elle, les aperçus de partage pointent vers localhost ou restent vides.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE.name} — Agence digitale à Libreville, Gabon`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [...SITE.keywords],
  authors: [{ name: SITE.name, url: SITE_URL }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "technology",
  alternates: { canonical: "/", languages: { fr: "/", "x-default": "/" } },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: SITE.locale,
    url: SITE_URL,
    title: `${SITE.name} — Agence digitale à Libreville, Gabon`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Agence digitale à Libreville, Gabon`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Ciblage régional : Libreville, Estuaire (GA-1), Gabon.
  other: {
    "geo.region": "GA-1",
    "geo.placename": SITE.address.locality,
    "geo.position": `${SITE.geo.latitude};${SITE.geo.longitude}`,
    ICBM: `${SITE.geo.latitude}, ${SITE.geo.longitude}`,
  },
  // iOS ignore le manifest pour ces trois réglages et n'écoute que ses
  // propres meta — sans elles, l'app ajoutée à l'écran d'accueil rouvre
  // dans Safari avec sa barre d'adresse au lieu de s'ouvrir en plein écran.
  appleWebApp: {
    capable: true,
    title: "Soken's",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // Empêche iOS de transformer numéros et dates en liens bleus au milieu
  // des tableaux financiers.
  formatDetection: { telephone: false, date: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#0e121a",
  width: "device-width",
  initialScale: 1,
  // `viewportFit: cover` + les safe-area-inset du CSS : indispensable pour
  // que le contenu ne passe pas sous l'encoche ou la barre d'accueil des
  // iPhone en mode installé.
  viewportFit: "cover",
  // On ne bloque pas le zoom : c'est une régression d'accessibilité réelle
  // pour les personnes malvoyantes, et le layout est déjà responsive.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning : le script de thème de l'admin
    // (ADMIN_THEME_BOOTSTRAP, app/admin/layout.tsx) pose data-admin-theme sur
    // <html> avant l'hydratation, exprès, pour éviter un flash de thème.
    // Ne s'applique qu'aux attributs de <html>, pas à ses enfants.
    <html
      lang="fr"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        {children}
        <PublicChatWidgetGate />
        <CookieConsentGate />
        <PostHogProvider />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
