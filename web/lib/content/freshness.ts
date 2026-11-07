import { routes, type ServiceSlug } from "@/lib/routes";

/**
 * Fraîcheur éditoriale du site, page par page.
 *
 * `sitemap.ts` déclarait auparavant une date unique pour les 28 URL. Google
 * apprend à ignorer `lastmod` quand il ne distingue plus rien : une même date
 * sur des contenus modifiés à des moments différents, c'est un signal mort.
 *
 * On déclare donc une date par page et par fiche service, toutes réelles et
 * stables d'un appel à l'autre. Chaque date est la dernière modification
 * *éditoriale* de l'entrée, relevée dans l'historique Git (fichier de page,
 * composant qui porte le texte, JSON éditorial ou fiche du catalogue) : aucune
 * n'est calculée au rendu, aucune ne suit l'horloge.
 *
 * **Règle de tenue** : une date ne bouge que si le texte public de la page ou
 * de la fiche change vraiment (copie, offre, tarifs, nouvelles fiches). Un
 * correctif technique invisible à l'écran ne justifie pas de la toucher, et une
 * date ne doit jamais être postérieure au jour courant.
 */

/** Jour ISO `AAAA-MM-JJ`, ancré à midi UTC pour éviter tout décalage de fuseau. */
export type IsoDay = `${number}-${number}-${number}`;

const NOON_UTC = "T12:00:00.000Z";

/**
 * Pages statiques, par route publique.
 *
 * `satisfies` garantit qu'aucune route de `routes` n'est oubliée et qu'aucune
 * clé fantôme n'y traîne.
 */
export const PAGE_UPDATED = {
  [routes.home]: "2026-11-05",
  [routes.realisations]: "2026-11-02",
  [routes.services]: "2026-11-04",
  [routes.aPropos]: "2026-11-04",
  [routes.agentsIa]: "2026-11-02",
  [routes.contact]: "2026-11-05",
  [routes.mentionsLegales]: "2026-11-02",
  [routes.ressources]: "2026-11-03",
  [routes.calculateurBudgetIdentite]: "2026-11-03",
  [routes.guidePrixLogo]: "2026-11-05",
  [routes.guideTendances2027]: "2026-11-05",
  [routes.generateurBriefIdentite]: "2026-11-03",
  [routes.testerSonLogo]: "2026-11-03",
} satisfies Record<(typeof routes)[keyof typeof routes], IsoDay>;

/** Slug de service qui possède sa propre fiche dans `/services/`. */
export type ServicePageSlug = Exclude<ServiceSlug, "agents-ia">;

/**
 * Fiches service, par slug. L'offre « agents IA » n'a pas de fiche dans
 * `/services/` : elle vit à la racine et prend la date de `PAGE_UPDATED`.
 */
export const SERVICE_UPDATED: Record<ServicePageSlug, IsoDay> = {
  "identite-de-marque": "2026-11-06",
  "direction-artistique": "2026-11-06",
  "site-ecommerce": "2026-11-06",
  "contenu-reseaux": "2026-11-06",
};

/**
 * Fiches réalisations : le catalogue de l'admin n'expose pas d'`updated_at`,
 * on partage donc la date de la dernière évolution éditoriale connue du
 * catalogue (graine et présentations projet).
 */
export const PROJECTS_UPDATED: IsoDay = "2026-11-05";

/** Repli : entrée inconnue des tables ci-dessus. */
export const CONTENT_UPDATED: IsoDay = "2026-11-05";

const toDate = (day: IsoDay): Date => new Date(`${day}${NOON_UTC}`);

/** `lastModified` d'une page statique, depuis sa route. */
export function pageUpdated(route: (typeof routes)[keyof typeof routes]): Date {
  return toDate(PAGE_UPDATED[route] ?? CONTENT_UPDATED);
}

/** `lastModified` d'une fiche service, depuis son slug. */
export function serviceUpdated(slug: ServiceSlug): Date {
  if (slug === "agents-ia") return pageUpdated(routes.agentsIa);
  return toDate(SERVICE_UPDATED[slug] ?? CONTENT_UPDATED);
}

/** `lastModified` d'une fiche réalisation. */
export function projectsUpdated(): Date {
  return toDate(PROJECTS_UPDATED);
}

/** Repli général, conservé pour les appels qui ne visent aucune entrée précise. */
export function contentUpdated(): Date {
  return toDate(CONTENT_UPDATED);
}
