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
  { source: "/contact.html", destination: "/a-propos#contact" },
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
  { source: "/contact", destination: "/a-propos#contact" },
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
      // Préversion /v5 : chaque page rejoint son équivalent à la racine.
      { source: "/v5", destination: "/", statusCode: 301 },
      { source: "/v5/index.html", destination: "/", statusCode: 301 },
      { source: "/v5/a-propos.html", destination: "/a-propos", statusCode: 301 },
      { source: "/v5/agents-ia.html", destination: "/agents-ia", statusCode: 301 },
      { source: "/v5/realisations.html", destination: "/realisations", statusCode: 301 },
      { source: "/v5/projet.html", destination: "/realisations/vaasam", statusCode: 301 },
      { source: "/v5/services.html", destination: "/services", statusCode: 301 },
      {
        source: "/v5/service-identite.html",
        destination: "/services/identite-de-marque",
        statusCode: 301,
      },
      {
        source: "/v5/service-direction-artistique.html",
        destination: "/services/direction-artistique",
        statusCode: 301,
      },
      {
        source: "/v5/service-site-ecommerce.html",
        destination: "/services/site-ecommerce",
        statusCode: 301,
      },
      {
        source: "/v5/service-contenu.html",
        destination: "/services/contenu-reseaux",
        statusCode: 301,
      },
      { source: "/v5/mentions-legales.html", destination: "/mentions-legales", statusCode: 301 },
      { source: "/v5/:path*", destination: "/", statusCode: 301 },
      ...legacyUrls.map((url) => ({ ...url, statusCode: 301 as const })),
    ];
  },
  /**
   * Back office : le domaine public est servi par Next, l'administration tourne dans
   * son propre conteneur FastAPI. On relaie ici ce qui lui appartient pour qu'elle
   * reste accessible sur `sujeedesign.com/admin`, avec une seule origine, un seul
   * certificat et des cookies de session sans problème de SameSite.
   *
   * `ADMIN_ORIGIN` est lu au build : les rewrites sont figés dans routes-manifest.
   * Pour changer de cible, il faut donc redéployer avec la nouvelle valeur.
   */
  async rewrites() {
    const admin = (
      process.env.ADMIN_ORIGIN || "https://admin-sujeedesign.145.241.167.66.sslip.io"
    ).replace(/\/+$/, "");
    return {
      beforeFiles: [
        { source: "/admin", destination: `${admin}/admin` },
        { source: "/admin/:path*", destination: `${admin}/admin/:path*` },
        { source: "/medias/:path*", destination: `${admin}/medias/:path*` },
        { source: "/api/admin/:path*", destination: `${admin}/api/admin/:path*` },
        { source: "/api/editor/:path*", destination: `${admin}/api/editor/:path*` },
        // Assets du back office et de l'éditeur visuel : le site Next possède son
        // propre dossier public/assets, on ne relaie que les fichiers qui lui
        // manquent (voir tests/admin-proxy.test.ts).
        { source: "/bo/assets/:path*", destination: `${admin}/bo/assets/:path*` },
        { source: "/assets/editor/:path*", destination: `${admin}/assets/editor/:path*` },
        { source: "/assets/projects/:path*", destination: `${admin}/assets/projects/:path*` },
        { source: "/assets/fonts/:path*", destination: `${admin}/assets/fonts/:path*` },
        { source: "/assets/admin.css", destination: `${admin}/assets/admin.css` },
        { source: "/assets/admin.js", destination: `${admin}/assets/admin.js` },
        {
          source: "/assets/logo-sujeepan-sabesan.svg",
          destination: `${admin}/assets/logo-sujeepan-sabesan.svg`,
        },
        {
          source: "/assets/logo-sujeepan-sabesan-clair.svg",
          destination: `${admin}/assets/logo-sujeepan-sabesan-clair.svg`,
        },
        {
          source: "/assets/icon_sujeepansabesan.svg",
          destination: `${admin}/assets/icon_sujeepansabesan.svg`,
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
