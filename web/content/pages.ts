import services from "./services.json";
import realisations from "./realisations.json";
import aPropos from "./a-propos.json";
import agentsIa from "./agents-ia.json";

/**
 * Contenu éditable des pages secondaires.
 *
 * Même principe que `home.json` : les valeurs vivent dans un JSON versionné, que
 * `scripts/pull-content.mjs` remplace au build par la version enregistrée dans
 * le back office. Les pages projet ne sont pas ici : elles sont générées depuis
 * l'admin (projets, médias, ordre), pas éditées en place.
 */
export type PageHero = {
  kicker?: string;
  title?: string[];
  lead?: string;
  lead2?: string;
};

export type PageDoc = { hero?: PageHero };

export const pageDocs: Record<string, PageDoc> = {
  services,
  realisations,
  "a-propos": aPropos,
  "agents-ia": agentsIa,
};

/**
 * Bannière d'une page secondaire. Le document vient de la base (voir
 * `lib/content/live.ts`) ; `pageDocs` ne sert plus que de repli au build.
 */
export function pageHero(doc: PageDoc | undefined): PageHero {
  return doc?.hero ?? {};
}

/** Ligne de titre : renvoie la valeur enregistrée ou le texte de repli. */
export function line(value: string[] | undefined, index: number, fallback: string): string {
  const found = value?.[index];
  return found && found.trim() ? found : fallback;
}
