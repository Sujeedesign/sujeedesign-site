/**
 * Pages dont le contenu est éditable en place par l'éditeur visuel.
 *
 * Le miroir de cette liste vit dans `app/admin.py` (schémas de contenu par page) :
 * une page absente ici n'a aucun attribut `data-field` dans le DOM, donc l'éditeur
 * n'a rien à accrocher.
 *
 * Correspondance exacte volontaire : les fiches `/services/<slug>` partagent le
 * premier segment avec `/services` mais ont chacune leur propre document. Raisonner
 * sur le premier segment seul affichait « Modifier la page » sur la mauvaise page.
 */
const EDITABLE_PAGES: Record<string, string> = {
  "/": "home",
  "/services": "services",
  "/realisations": "realisations",
  "/a-propos": "a-propos",
  "/agents-ia": "agents-ia",
  "/services/identite-de-marque": "identite-de-marque",
  "/services/direction-artistique": "direction-artistique",
  "/services/site-ecommerce": "site-ecommerce",
  "/services/contenu-reseaux": "contenu-reseaux",
};

/** Normalise une URL de navigation en chemin comparable (`/services/` → `/services`). */
export function normalizePath(pathname: string): string {
  const bare = (pathname || "/").split(/[?#]/)[0] ?? "/";
  const clean = bare.replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
}

/** Slug de contenu éditable pour ce chemin, ou `null` si la page n'est pas branchée. */
export function editableSlug(pathname: string): string | null {
  return EDITABLE_PAGES[normalizePath(pathname)] ?? null;
}

/** Slug de contenu à interroger pour ce chemin (repli `home`, comme le back office). */
export function pageSlug(pathname: string): string {
  return editableSlug(pathname) ?? "home";
}
