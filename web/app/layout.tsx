import type { Metadata, Viewport } from "next";
import { BodyClass, bodyClassScript } from "@/components/site/body-class";
import { Analytics } from "@/components/site/analytics";
import { SiteScripts } from "@/components/site/scripts";
import { GOOGLE_SITE_VERIFICATION } from "@/lib/analytics";
import { assetHref } from "@/lib/asset-version";

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
  verification: GOOGLE_SITE_VERIFICATION ? { google: GOOGLE_SITE_VERIFICATION } : undefined,
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
        {/* CSS du v5, copiés à l'identique : rendu pixel-équivalent.
            `?v=<hash>` : les noms ne sont pas versionnés, le paramètre évite qu'un
            cache long serve une feuille périmée après déploiement. */}
        <link rel="stylesheet" href={assetHref("site.css")} />
        <link rel="stylesheet" href={assetHref("light.css")} />
        <link rel="stylesheet" href={assetHref("ds.css")} />
        <link rel="stylesheet" href={assetHref("anim.css")} />
      </head>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: bodyClassScript }} />
        <BodyClass />
        {children}
        <SiteScripts />
        <Analytics />
      </body>
    </html>
  );
}
