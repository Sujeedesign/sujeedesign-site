/**
 * Configuration de la mesure d'audience.
 *
 * L'identifiant GA4 n'est pas un secret : il peut vivre dans le dépôt. On garde
 * quand même la priorité à la variable d'environnement pour pouvoir tester une
 * autre propriété sans toucher au code.
 */
export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_ID ?? "G-998CG8JQEJ";

/** Jeton de vérification Search Console, méthode « balise HTML ». */
export const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GSC_TOKEN ?? "TlVzwqRwXwnej9BHbAojNf2BZqcSZ8Dq7CgO4s4oB_Q";

/** Clé publique de consentement stockée côté navigateur. */
export const CONSENT_KEY = "sd-consent";

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
};

/**
 * Envoie un événement GA4 depuis le client.
 *
 * Le chargeur de `components/site/analytics.tsx` n'installe `window.gtag` qu'après
 * consentement : sans consentement (ou avant hydratation), l'appel est un no-op.
 * Aucun script tiers n'est ajouté ici.
 */
export function trackEvent(name: string, params: Record<string, string | number | boolean> = {}): void {
  if (typeof window === "undefined") return;
  const gtag = (window as GtagWindow).gtag;
  if (typeof gtag !== "function") return;
  gtag("event", name, params);
}
