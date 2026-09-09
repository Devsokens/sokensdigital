import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { PublicChatWidgetGate } from "@/components/public-chat-widget-gate";
import { ServiceWorkerRegistrar } from "@/components/pwa/service-worker-registrar";
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
  title: "Soken's Digital — Excellence Digitale sur Mesure",
  description:
    "Soken's Digital transforme vos visions en solutions technologiques haute performance : logiciels critiques, applications cloud et infrastructures sécurisées.",
  applicationName: "Soken's Digital",
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
    <html
      lang="fr"
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <PublicChatWidgetGate />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
