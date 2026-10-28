import Script from "next/script";

import { assetHref } from "@/lib/asset-version";

/**
 * Comportements de la vitrine, repris tels quels du v5.
 *
 * Le v5 charge GSAP 3.13 + ScrollTrigger avant `site.js` (pin du hero de l'accueil)
 * et `rl.js` sur la page réalisations (révélation du titre, scènes pinées).
 * Les bibliothèques sont servies localement depuis `public/assets` : même version,
 * même comportement, aucune dépendance à un CDN tiers.
 *
 * Les scripts sont chargés avec `?v=<empreinte>` : comme les CSS, leurs noms ne
 * contiennent pas de hash, et le cache long posé dans `next.config.ts` servirait
 * une version périmée après déploiement.
 */
export function SiteScripts() {
  return (
    <>
      <Script src={assetHref("gsap.min.js")} strategy="afterInteractive" />
      <Script src={assetHref("ScrollTrigger.min.js")} strategy="afterInteractive" />
      <Script src={assetHref("site.js")} strategy="afterInteractive" />
      <Script src={assetHref("anim.js")} strategy="afterInteractive" />
      <Script src={assetHref("rl.js")} strategy="afterInteractive" />
    </>
  );
}
