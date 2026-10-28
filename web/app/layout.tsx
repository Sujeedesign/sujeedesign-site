import type { Metadata, Viewport } from "next";
import { BodyClass, bodyClassScript } from "@/components/site/body-class";
import { SiteScripts } from "@/components/site/scripts";
import { professionalServiceJsonLd } from "@/content/site";

export const metadata: Metadata = {
  metadataBase: new URL("https://sujeedesign.com"),
  title: {
    default: "Sujee Design — Studio de design, Cergy et Paris",
    template: "%s — Sujee Design",
  },
  description:
    "Studio de design indépendant entre Cergy et Paris. Identité, direction artistique, sites web et outils IA, du premier croquis à la mise en ligne.",
  applicationName: "Sujee Design",
  authors: [{ name: "Sujeepan Sabesan", url: "https://sujeedesign.com/a-propos" }],
  creator: "Sujeepan Sabesan",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Sujee Design",
    locale: "fr_FR",
    url: "/",
    title: "Sujee Design — Studio de design, Cergy et Paris",
    description:
      "Identité, direction artistique, sites et outils IA. Un seul interlocuteur, de la première esquisse à la mise en ligne.",
    images: [
      {
        url: "/assets/img/og/studio.jpg",
        width: 1200,
        height: 630,
        alt: "Sujee Design, studio de design à Cergy et Paris",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sujee Design — Studio de design, Cergy et Paris",
    description: "Identité, direction artistique, sites et outils IA, entre Cergy et Paris.",
    images: ["/assets/img/og/studio.jpg"],
  },
  icons: { icon: [{ url: "/assets/favicon.svg", type: "image/svg+xml" }] },
};

export const viewport: Viewport = {
  themeColor: "#F4F1E8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Space+Grotesk:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* CSS du v5, copiés à l'identique : rendu pixel-équivalent. */}
        <link rel="stylesheet" href="/assets/site.css" />
        <link rel="stylesheet" href="/assets/light.css" />
        <link rel="stylesheet" href="/assets/ds.css" />
        <link rel="stylesheet" href="/assets/anim.css" />
      </head>
      <body suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(professionalServiceJsonLd()) }}
        />
        <script dangerouslySetInnerHTML={{ __html: bodyClassScript }} />
        <BodyClass />
        {children}
        <SiteScripts />
      </body>
    </html>
  );
}
