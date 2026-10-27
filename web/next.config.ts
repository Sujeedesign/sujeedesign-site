import type { NextConfig } from "next";

/**
 * Redirections permanentes.
 *
 * Le v5 remplace intégralement l'ancien site : la préversion `/v5` disparaît au profit de la
 * racine. Deux familles d'URL héritées sont reprises ici :
 *
 * 1. les fichiers du site statique historique (`/index.html`, `/apropos.html`, …) ;
 * 2. les adresses du site FastAPI qui tourne aujourd'hui (`/services/identite`,
 *    `/realisations/vaasam-paris`, …), relevées dans `seed/content.json` et dans la table
 *    `redirections`. Les slugs du v5 n'étant pas ceux de l'ancien site, ces renvois sont
 *    indispensables pour ne pas casser le référencement.
 */
const legacyUrls: Array<{ source: string; destination: string }> = [
  // Site statique historique
  { source: "/index.html", destination: "/" },
  { source: "/realisations.html", destination: "/realisations" },
  { source: "/services.html", destination: "/services" },
  { source: "/apropos.html", destination: "/a-propos" },
  { source: "/contact.html", destination: "/a-propos" },
  { source: "/mentions-legales.html", destination: "/mentions-legales" },
  { source: "/identite.html", destination: "/services/identite-de-marque" },
  { source: "/creation-visuelle.html", destination: "/services/direction-artistique" },
  { source: "/web.html", destination: "/services/site-ecommerce" },
  { source: "/marketing.html", destination: "/services/contenu-reseaux" },
  { source: "/ia.html", destination: "/agents-ia" },
  { source: "/projet-vaasam.html", destination: "/realisations/vaasam" },
  { source: "/projet-rfa.html", destination: "/realisations" },
  { source: "/projet-ia.html", destination: "/agents-ia" },
  { source: "/projet-formation.html", destination: "/a-propos" },

  // Site FastAPI en production (slugs antérieurs au v5)
  { source: "/contact", destination: "/a-propos" },
  { source: "/services/identite", destination: "/services/identite-de-marque" },
  { source: "/services/creation-visuelle", destination: "/services/direction-artistique" },
  { source: "/services/web", destination: "/services/site-ecommerce" },
  { source: "/services/marketing", destination: "/services/contenu-reseaux" },
  { source: "/services/ia", destination: "/agents-ia" },
  { source: "/services/agents-ia", destination: "/agents-ia" },
  { source: "/realisations/vaasam-paris", destination: "/realisations/vaasam" },
  { source: "/realisations/resto-franchise-africain", destination: "/realisations" },
  { source: "/realisations/solutions-ia-automations", destination: "/agents-ia" },
  { source: "/realisations/formation-ui-ux-pao", destination: "/a-propos" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/v5", destination: "/", statusCode: 301 },
      { source: "/v5/:path*", destination: "/", statusCode: 301 },
      ...legacyUrls.map((url) => ({ ...url, statusCode: 301 as const })),
    ];
  },
};

export default nextConfig;
