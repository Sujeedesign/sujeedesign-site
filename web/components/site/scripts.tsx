import Script from "next/script";

/**
 * Comportements de la vitrine, chargés après hydratation.
 *
 * `site.js` et `anim.js` sont repris tels quels du v5 : ils n'utilisent que des API natives
 * (`IntersectionObserver`, `matchMedia`, `requestAnimationFrame`). Le v5 ne chargeait pas GSAP,
 * donc on ne l'ajoute pas : aucune dépendance à un CDN tiers, rien de plus à charger sur mobile.
 */
export function SiteScripts() {
  return (
    <>
      <Script src="/assets/site.js" strategy="afterInteractive" />
      <Script src="/assets/anim.js" strategy="afterInteractive" />
    </>
  );
}
