/**
 * Table des routes publiques de la vitrine.
 *
 * Une seule source pour les liens internes : aucun `href` en dur dans les composants.
 * Les chemins reprennent ceux de l'ancien site (sans `.html`, sans préfixe `/v5`), pour
 * conserver le référencement sans redirection.
 */
export const routes = {
  home: "/",
  realisations: "/realisations",
  services: "/services",
  aPropos: "/a-propos",
  agentsIa: "/agents-ia",
  contact: "/contact",
  mentionsLegales: "/mentions-legales",
  /** Hub des pages outils et guides, hors menu principal. */
  ressources: "/ressources",
  /** Calculateur de budget identité. */
  calculateurBudgetIdentite: "/ressources/calculateur-budget-identite",
  /** Guide de prix du logo. */
  guidePrixLogo: "/guides/prix-logo",
  /** Guide de prix d'un site internet. */
  guidePrixSite: "/guides/prix-site-internet",
  /** Guide des tendances web design 2027. */
  guideTendances2027: "/guides/tendances-web-design-2027",
  /** Générateur de brief identité, avec export PDF. */
  generateurBriefIdentite: "/ressources/generateur-brief-identite",
  /** Test de logo : lisibilité, contraste, un seul ton. */
  testerSonLogo: "/ressources/tester-son-logo",
} as const;

/** Slugs des cinq services, dans l'ordre éditorial 01 → 05. */
export const serviceSlugs = [
  "identite-de-marque",
  "direction-artistique",
  "site-ecommerce",
  "contenu-reseaux",
  "agents-ia",
] as const;

export type ServiceSlug = (typeof serviceSlugs)[number];

export function servicePath(slug: ServiceSlug): string {
  return `${routes.services}/${slug}`;
}

/**
 * Lien public d'un service : l'offre « agents IA » vit à la racine (`/agents-ia`),
 * hors arborescence `/services`, comme dans le v5.
 */
export function serviceHref(slug: ServiceSlug): string {
  return slug === "agents-ia" ? routes.agentsIa : servicePath(slug);
}

export function realisationPath(slug: string): string {
  return `${routes.realisations}/${slug}`;
}

/**
 * Contact : adresse et téléphone publics du studio.
 *
 * Source unique. Les CTA ne pointent jamais vers `mailto:` : ils ouvrent la page
 * `/contact` (formulaire + assistant). L'adresse n'est utilisée que là où elle est
 * affichée en clair (pied de page, mentions légales, page contact).
 */
export const CONTACT_EMAIL = "hello@sujeedesign.com";

/** Numéro affiché, groupé à la française. */
export const CONTACT_PHONE = "06 51 51 74 63";

/** Même numéro au format E.164, pour les liens `tel:`. */
export const CONTACT_PHONE_HREF = "tel:+33651517463";

export function mailto(subject?: string): string {
  const base = `mailto:${CONTACT_EMAIL}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}
