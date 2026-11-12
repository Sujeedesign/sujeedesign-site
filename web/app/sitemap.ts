import type { MetadataRoute } from "next";
import { routes, realisationPath, serviceHref, serviceSlugs } from "@/lib/routes";
import { getProjects } from "@/lib/content/catalogue";
import { projectUpdated, pageUpdated, serviceUpdated } from "@/lib/content/freshness";

const SITE_URL = "https://sujeedesign.com";

/**
 * Plan du site.
 *
 * Les routes dynamiques sont générées depuis la même source que les pages : les
 * services depuis `serviceSlugs`, les réalisations depuis le catalogue publié
 * dans l'admin (repli sur les fiches du dépôt).
 *
 * `lastModified` n'est jamais `new Date()` : chaque entrée prend la date
 * éditoriale de sa propre page (`pageUpdated`), de sa propre fiche service
 * (`serviceUpdated`) ou de la fiche réalisation elle-même (`projectUpdated`,
 * alimenté par l'`updated_at` du catalogue).
 * Voir `lib/content/freshness.ts`.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}${routes.home}`,
      lastModified: pageUpdated(routes.home),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}${routes.realisations}`,
      lastModified: pageUpdated(routes.realisations),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}${routes.services}`,
      lastModified: pageUpdated(routes.services),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}${routes.aPropos}`,
      lastModified: pageUpdated(routes.aPropos),
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}${routes.agentsIa}`,
      lastModified: pageUpdated(routes.agentsIa),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.contact}`,
      lastModified: pageUpdated(routes.contact),
      changeFrequency: "yearly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}${routes.mentionsLegales}`,
      lastModified: pageUpdated(routes.mentionsLegales),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${SITE_URL}${routes.ressources}`,
      lastModified: pageUpdated(routes.ressources),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}${routes.calculateurBudgetIdentite}`,
      lastModified: pageUpdated(routes.calculateurBudgetIdentite),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.guidePrixLogo}`,
      lastModified: pageUpdated(routes.guidePrixLogo),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.modeleCahierDesCharges}`,
      lastModified: pageUpdated(routes.modeleCahierDesCharges),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.guidePrixSite}`,
      lastModified: pageUpdated(routes.guidePrixSite),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.guideAgenceFreelance}`,
      lastModified: pageUpdated(routes.guideAgenceFreelance),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.guideTendances2027}`,
      lastModified: pageUpdated(routes.guideTendances2027),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.generateurBriefIdentite}`,
      lastModified: pageUpdated(routes.generateurBriefIdentite),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.testerSonLogo}`,
      lastModified: pageUpdated(routes.testerSonLogo),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}${routes.testContraste}`,
      lastModified: pageUpdated(routes.testContraste),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    // Tunnel de vente hors navigation : page produit autonome, non listée dans la nav.
    {
      url: `${SITE_URL}/reussir-examen-vtc`,
      lastModified: "2026-11-12",
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const services: MetadataRoute.Sitemap = serviceSlugs.map((slug) => ({
    url: `${SITE_URL}${serviceHref(slug)}`,
    lastModified: serviceUpdated(slug),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const projectPages: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${SITE_URL}${realisationPath(project.slug)}`,
    lastModified: projectUpdated(project),
    changeFrequency: "yearly",
    priority: 0.7,
  }));

  // `agents-ia` figure à la fois dans les pages statiques et dans les services : on dédoublonne.
  const seen = new Set<string>();
  return [...staticPages, ...services, ...projectPages].filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}
