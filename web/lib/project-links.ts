import type { Project } from "@/content/projects";
import { projects } from "@/content/projects";
import { serviceCatalog, serviceNode, type SchemaNode } from "@/lib/structured-data";
import type { ServiceSlug } from "@/lib/routes";
import { serviceHref } from "@/lib/routes";

/**
 * Liens éditoriaux entre projets et services.
 *
 * Source unique : les disciplines de `content/projects.ts`. Ce fichier ne contient
 * aucun texte de page, seulement des correspondances discipline → service.
 */

/** Chaque discipline d'une fiche pointe vers le ou les services qui la portent. */
export const disciplineServices: Record<string, ServiceSlug[]> = {
  "Direction artistique": ["direction-artistique"],
  "Design de présentation": ["direction-artistique", "contenu-reseaux"],
  Illustration: ["direction-artistique"],
  Présentation: ["contenu-reseaux", "direction-artistique"],
  "Direction photo": ["direction-artistique", "contenu-reseaux"],
  "Jeu web": ["site-ecommerce"],
  Interface: ["site-ecommerce"],
  "Application mobile": ["site-ecommerce"],
  UI: ["site-ecommerce"],
  "Site web": ["site-ecommerce"],
  "Design system": ["site-ecommerce"],
  "E-commerce": ["site-ecommerce"],
  Identité: ["identite-de-marque"],
  Logotypes: ["identite-de-marque"],
};

/** Ordre éditorial des services, pour trier les liens de façon stable. */
const serviceOrder = Object.keys(serviceCatalog) as ServiceSlug[];

function projectServices(project: Project): ServiceSlug[] {
  const found = new Set<ServiceSlug>();
  for (const discipline of project.disciplines) {
    for (const slug of disciplineServices[discipline] ?? []) found.add(slug);
  }
  return serviceOrder.filter((slug) => found.has(slug));
}

export type LinkedService = {
  slug: ServiceSlug;
  name: string;
  href: string;
  node: SchemaNode;
};

/** Services à lier depuis une fiche (au plus `limit`), dans l'ordre éditorial. */
export function linkedServices(project: Project, limit = 2): LinkedService[] {
  return projectServices(project)
    .slice(0, limit)
    .map((slug) => ({
      slug,
      name: serviceCatalog[slug].name,
      href: serviceHref(slug),
      node: serviceNode(slug),
    }));
}

/**
 * Projets liés : deux fiches maximum, classées par proximité éditoriale
 * (disciplines communes d'abord, puis services communs), complétées par l'ordre
 * courant pour ne jamais laisser le bloc vide.
 */
export function relatedProjects(project: Project, limit = 2): Project[] {
  const disciplines = new Set(project.disciplines);
  const services = new Set(projectServices(project));

  const ranked = projects
    .filter((candidate) => candidate.slug !== project.slug)
    .map((candidate, index) => {
      const sharedDisciplines = candidate.disciplines.filter((d) => disciplines.has(d)).length;
      const sharedServices = projectServices(candidate).filter((s) => services.has(s)).length;
      return { candidate, index, score: sharedDisciplines * 2 + sharedServices };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.candidate);

  return ranked.slice(0, limit);
}
