/**
 * Fraîcheur éditoriale du site.
 *
 * `sitemap.ts` déclarait jusqu'ici `lastModified: new Date()` : chaque appel du
 * plan de site affirmait que les 28 pages venaient d'être modifiées. Google
 * détecte cette incohérence (la date change sans que le contenu change) et finit
 * par ignorer complètement `lastmod`, ce qui prive le site d'un signal de
 * fraîcheur.
 *
 * On déclare donc une date réelle, stable, identique d'un appel à l'autre.
 * **À mettre à jour à la main quand le contenu public change vraiment** (texte,
 * offre, tarifs, nouvelles fiches) : c'est la seule chose que Google demande.
 */
export const CONTENT_UPDATED = "2026-11-05";

/** Date `lastModified` du plan de site, ancrée à midi UTC pour éviter tout décalage. */
export function contentUpdated(): Date {
  return new Date(`${CONTENT_UPDATED}T12:00:00.000Z`);
}
