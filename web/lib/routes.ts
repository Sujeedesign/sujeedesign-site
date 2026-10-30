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

/** Contact : adresse unique reprise du v5. */
export const CONTACT_EMAIL = "s.sujeepan.pro@gmail.com";

export function mailto(subject?: string): string {
  const base = `mailto:${CONTACT_EMAIL}`;
  return subject ? `${base}?subject=${encodeURIComponent(subject)}` : base;
}
