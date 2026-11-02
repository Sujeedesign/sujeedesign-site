import type { MetadataRoute } from "next";
import { routes, realisationPath, serviceHref, serviceSlugs } from "@/lib/routes";
import { getProjects } from "@/lib/content/catalogue";

const SITE_URL = "https://sujeedesign.com";

/**
 * Plan du site.
 *
 * Les routes dynamiques sont générées depuis la même source que les pages : les
 * services depuis `serviceSlugs`, les réalisations depuis le catalogue publié
 * dans l'admin (repli sur les fiches du dépôt).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await getProjects();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}${routes.home}`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    {
      url: `${SITE_URL}${routes.realisations}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    { url: `${SITE_URL}${routes.services}`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}${routes.aPropos}`, lastModified: now, changeFrequency: "yearly", priority: 0.7 },
    { url: `${SITE_URL}${routes.agentsIa}`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}${routes.contact}`, lastModified: now, changeFrequency: "yearly", priority: 0.9 },
    {
      url: `${SITE_URL}${routes.mentionsLegales}`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  const services: MetadataRoute.Sitemap = serviceSlugs.map((slug) => ({
    url: `${SITE_URL}${serviceHref(slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const projectPages: MetadataRoute.Sitemap = projects.map((project) => ({
    url: `${SITE_URL}${realisationPath(project.slug)}`,
    lastModified: now,
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
