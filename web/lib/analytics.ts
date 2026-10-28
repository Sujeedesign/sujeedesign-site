/**
 * Configuration de la mesure d'audience.
 *
 * L'identifiant GA4 n'est pas un secret : il peut vivre dans le dépôt. On garde
 * quand même la priorité à la variable d'environnement pour pouvoir tester une
 * autre propriété sans toucher au code.
 */
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

/** Jeton de vérification Search Console, méthode « balise HTML ». */
export const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GSC_TOKEN ?? "";

/** Clé publique de consentement stockée côté navigateur. */
export const CONSENT_KEY = "sd-consent";
