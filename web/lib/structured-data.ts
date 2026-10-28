import { site } from "@/content/site";
import type { Project } from "@/content/projects";
import { realisationPath, routes, serviceHref, type ServiceSlug } from "@/lib/routes";

/**
 * Données structurées de la vitrine.
 *
 * Un seul graphe `@graph` par page, assemblé par `pageGraph()`. Les nœuds de base
 * (studio, personne, site) sont toujours présents pour que les `@id` référencés
 * par les nœuds de page se résolvent dans le même document.
 *
 * Règle : rien d'inventé. Pas d'`aggregateRating`, pas de prix, pas d'avis.
 * Les valeurs viennent de `content/site.ts` et `content/projects.ts`.
 */

/** Identifiants stables, référencés tels quels depuis tous les nœuds. */
export const SCHEMA_IDS = {
  studio: `${site.url}/#studio`,
  personne: `${site.url}/#personne`,
  site: `${site.url}/#site`,
} as const;

export const IN_LANGUAGE = "fr-FR";

/** Chemin interne → URL absolue. */
export function absoluteUrl(path: string): string {
  return new URL(path, `${site.url}/`).toString();
}

/** Image de partage d'une page (`/assets/img/og/<slug>.jpg`). */
export function ogImage(path: string): string {
  return absoluteUrl(`/assets/img/og/${path}.jpg`);
}

function imageObject(url: string) {
  return { "@type": "ImageObject", url, width: 1200, height: 630 };
}

/**
 * Noms publics des services. Les descriptions restent dans les composants :
 * la page les passe à `serviceNode()` pour éviter toute duplication de texte.
 */
export const serviceCatalog: Record<ServiceSlug, { name: string; serviceType: string }> = {
  "identite-de-marque": { name: "Identité de marque", serviceType: "Création d'identité visuelle" },
  "direction-artistique": {
    name: "Direction artistique",
    serviceType: "Direction artistique et création visuelle",
  },
  "site-ecommerce": { name: "Site & e-commerce", serviceType: "Création de site vitrine et e-commerce" },
  "contenu-reseaux": { name: "Contenu & réseaux", serviceType: "Production de contenu et réseaux sociaux" },
  "agents-ia": { name: "Agents IA", serviceType: "Automatisation et agents IA" },
};

/** Le studio, ancré sur `#studio`. */
export function studioNode() {
  return {
    "@type": "ProfessionalService",
    "@id": SCHEMA_IDS.studio,
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    email: site.email,
    slogan: site.tagline,
    founder: { "@id": SCHEMA_IDS.personne },
    areaServed: site.areaServed,
    address: {
      "@type": "PostalAddress",
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
    },
    sameAs: site.socials.map((social) => social.href),
    knowsAbout: Object.values(serviceCatalog).map((service) => service.name),
  };
}

/** Sujeepan Sabesan, ancré sur `#personne`. */
export function personNode() {
  return {
    "@type": "Person",
    "@id": SCHEMA_IDS.personne,
    name: site.founder,
    jobTitle: "Designer, photographe et formateur",
    url: absoluteUrl(routes.aPropos),
    image: imageObject(ogImage("a-propos")),
    worksFor: { "@id": SCHEMA_IDS.studio },
    sameAs: site.socials.map((social) => social.href),
  };
}

/** Le site lui-même, ancré sur `#site`. */
export function websiteNode() {
  return {
    "@type": "WebSite",
    "@id": SCHEMA_IDS.site,
    name: site.name,
    url: site.url,
    inLanguage: IN_LANGUAGE,
    publisher: { "@id": SCHEMA_IDS.studio },
  };
}

export type SchemaNode = Record<string, unknown>;

/** Assemble le graphe d'une page : nœuds de base + nœuds propres à la page. */
export function pageGraph(nodes: SchemaNode[] = []) {
  return {
    "@context": "https://schema.org",
    "@graph": [studioNode(), personNode(), websiteNode(), ...nodes],
  };
}

export type Crumb = { name: string; path: string };

/** Fil d'Ariane. Les `position` partent de 1, dans l'ordre du tableau. */
export function breadcrumbNode(crumbs: Crumb[]) {
  const last = crumbs[crumbs.length - 1];
  return {
    "@type": "BreadcrumbList",
    "@id": `${absoluteUrl(last?.path ?? routes.home)}#fil`,
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Année d'un projet. Certaines fiches couvrent une période (« 2013 — 2017 ») :
 * `dateCreated` ne peut alors pas être une année seule et part en
 * `temporalCoverage` au format ISO 8601.
 */
function projectDates(project: Project): { dateCreated?: string; temporalCoverage?: string } {
  const year = project.year?.trim();
  if (!year) return {};
  if (/^\d{4}$/.test(year)) return { dateCreated: year };
  const range = year.match(/(\d{4})\D+(\d{4})/u);
  if (range) return { temporalCoverage: `${range[1]}/${range[2]}` };
  return {};
}

/** Fiche projet, ancrée sur `<url>#projet`. */
export function creativeWorkNode(project: Project) {
  return {
    "@type": "CreativeWork",
    "@id": `${absoluteUrl(realisationPath(project.slug))}#projet`,
    name: project.name,
    url: absoluteUrl(realisationPath(project.slug)),
    description: project.pitch,
    ...projectDates(project),
    creator: { "@id": SCHEMA_IDS.personne },
    image: imageObject(ogImage(project.slug)),
    about: project.disciplines.map((discipline) => ({ "@type": "Thing", name: discipline })),
    keywords: project.disciplines.join(", "),
    inLanguage: IN_LANGUAGE,
    isPartOf: { "@id": SCHEMA_IDS.site },
  };
}

/** Page service, ancrée sur `<url>#service`. */
export function serviceNode(slug: ServiceSlug, description?: string) {
  const entry = serviceCatalog[slug];
  const url = absoluteUrl(serviceHref(slug));
  return {
    "@type": "Service",
    "@id": `${url}#service`,
    name: entry.name,
    serviceType: entry.serviceType,
    description,
    provider: { "@id": SCHEMA_IDS.studio },
    areaServed: site.areaServed,
    url,
    inLanguage: IN_LANGUAGE,
  };
}

/** Page simple (sommaire, à propos, mentions) : un `WebPage` relié au site. */
export function webPageNode(path: string, name: string, description?: string) {
  const url = absoluteUrl(path);
  return {
    "@type": "WebPage",
    "@id": `${url}#page`,
    name,
    description,
    url,
    inLanguage: IN_LANGUAGE,
    isPartOf: { "@id": SCHEMA_IDS.site },
    about: { "@id": SCHEMA_IDS.studio },
  };
}
