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
  { source: "/projet-vaasam.html", destination: "/realisations" },
  { source: "/projet-rfa.html", destination: "/realisations" },
  { source: "/projet-ia.html", destination: "/agents-ia" },
  { source: "/projet-formation.html", destination: "/a-propos" },

  // Projets retirés (démonstrations, puis Vaasam mis de côté) : leurs
  // anciennes adresses pointent vers le sommaire au lieu de renvoyer 404.
  { source: "/realisations/vaasam", destination: "/realisations" },
  { source: "/realisations/rfa", destination: "/realisations" },
  { source: "/realisations/atelier-24", destination: "/realisations" },
  { source: "/realisations/atelier-24-dix-ans", destination: "/realisations" },
  { source: "/realisations/mpt", destination: "/realisations" },
  { source: "/realisations/psw", destination: "/realisations" },

  // Site FastAPI en production (slugs antérieurs au v5)
  { source: "/contact", destination: "/a-propos#contact" },
  { source: "/services/identite", destination: "/services/identite-de-marque" },
  { source: "/services/creation-visuelle", destination: "/services/direction-artistique" },
  { source: "/services/web", destination: "/services/site-ecommerce" },
  { source: "/services/marketing", destination: "/services/contenu-reseaux" },
  { source: "/services/ia", destination: "/agents-ia" },
  { source: "/services/agents-ia", destination: "/agents-ia" },
  { source: "/realisations/vaasam-paris", destination: "/realisations" },
  { source: "/realisations/resto-franchise-africain", destination: "/realisations" },
  { source: "/realisations/solutions-ia-automations", destination: "/agents-ia" },
  { source: "/realisations/formation-ui-ux-pao", destination: "/a-propos" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // La normalisation du slash final est faite dans `middleware.ts` : sinon Next
  // renvoie `/v5/` en 308 vers `/v5` avant de pouvoir appliquer le 301 direct.
  skipTrailingSlashRedirect: true,
  async redirects() {
    return [
      // Préversion /v5 : chaque page rejoint son équivalent à la racine.
      { source: "/v5", destination: "/", statusCode: 301 },
      { source: "/v5/index.html", destination: "/", statusCode: 301 },
      { source: "/v5/a-propos.html", destination: "/a-propos", statusCode: 301 },
      { source: "/v5/agents-ia.html", destination: "/agents-ia", statusCode: 301 },
      { source: "/v5/realisations.html", destination: "/realisations", statusCode: 301 },
      { source: "/v5/projet.html", destination: "/realisations", statusCode: 301 },
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
   * En-têtes HTTP.
   *
   * Les fichiers de `public/` sont servis par Next avec `Cache-Control: public,
   * max-age=0` : chaque visite revalide images et feuilles de style. On pose un
   * cache long ici.
   *
   * Attention aux CSS : leur nom ne contient pas de hash, donc un `max-age` long
   * servirait une feuille périmée après déploiement. Deux garde-fous :
   *   1. `layout.tsx` les charge avec `?v=<empreinte du contenu>` (lib/asset-version.ts),
   *      qui change à chaque modification du fichier ;
   *   2. `stale-while-revalidate` laisse le navigateur rafraîchir en tâche de fond.
   * Les images de projets gardent leur nom d'origine : on reste à 30 jours, sans
   * `immutable`, et un déploiement qui remplace un fichier est donc revalidé au
   * plus tard au bout de la fenêtre de revalidation.
   */
  async headers() {
    const longCache = "public, max-age=2592000, stale-while-revalidate=604800";
    return [
      // HSTS : six mois, sans `includeSubDomains` ni `preload` tant que tous les
      // sous-domaines ne sont pas servis en https. Ignoré en http par les navigateurs.
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=15552000" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
      // Pages HTML : toujours revalidées, pour qu'un déploiement soit visible
      // immédiatement (les assets, eux, restent en cache long ci-dessous).
      {
        source: "/((?!_next/|assets/|static-admin/|bo/|api/|admin|medias/|robots.txt|sitemap.xml|favicon).*)",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      // Back office : jamais indexé, même si robots.txt le bloque déjà. On couvre
      // /admin et tout son sous-arbre, y compris les pages servies par la rewrite
      // vers FastAPI, pour que l'en-tête survive au proxy.
      {
        source: "/admin",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      // Images du site (projets, partages).
      { source: "/assets/img/:path*", headers: [{ key: "Cache-Control", value: longCache }] },
      // Photographies et portraits posés à la racine de /assets.
      { source: "/assets/sujeepan_sabesan.jpg", headers: [{ key: "Cache-Control", value: longCache }] },
      // Feuilles de style du v5, versionnées par query (voir layout.tsx).
      { source: "/assets/site.css", headers: [{ key: "Cache-Control", value: longCache }] },
      { source: "/assets/light.css", headers: [{ key: "Cache-Control", value: longCache }] },
      { source: "/assets/ds.css", headers: [{ key: "Cache-Control", value: longCache }] },
      { source: "/assets/anim.css", headers: [{ key: "Cache-Control", value: longCache }] },
      // Scripts du v5, versionnés par query eux aussi (voir components/site/scripts.tsx).
      { source: "/assets/gsap.min.js", headers: [{ key: "Cache-Control", value: longCache }] },
      { source: "/assets/ScrollTrigger.min.js", headers: [{ key: "Cache-Control", value: longCache }] },
      { source: "/assets/site.js", headers: [{ key: "Cache-Control", value: longCache }] },
      { source: "/assets/anim.js", headers: [{ key: "Cache-Control", value: longCache }] },
      { source: "/assets/rl.js", headers: [{ key: "Cache-Control", value: longCache }] },
      // Polices : même politique, elles ne changent pas entre deux déploiements.
      { source: "/assets/fonts/:path*", headers: [{ key: "Cache-Control", value: longCache }] },
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
        { source: "/static-admin/:path*", destination: `${admin}/static-admin/:path*` },
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
