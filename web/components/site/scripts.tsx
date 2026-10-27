import Script from "next/script";

/**
 * Comportements de la vitrine, repris tels quels du v5.
 *
 * Le v5 charge GSAP 3.13 + ScrollTrigger avant `site.js` (pin du hero de l'accueil)
 * et `rl.js` sur la page réalisations (révélation du titre, scènes pinées).
 * Les bibliothèques sont servies localement depuis `public/assets` : même version,
 * même comportement, aucune dépendance à un CDN tiers.
 */
export function SiteScripts() {
  return (
    <>
      <Script src="/assets/gsap.min.js" strategy="afterInteractive" />
      <Script src="/assets/ScrollTrigger.min.js" strategy="afterInteractive" />
      <Script src="/assets/site.js" strategy="afterInteractive" />
      <Script src="/assets/anim.js" strategy="afterInteractive" />
      <Script src="/assets/rl.js" strategy="afterInteractive" />
    </>
  );
}
