import { routes } from "@/lib/routes";

/**
 * Les CTA du site ouvrent la page contact, jamais le client mail.
 *
 * Le contenu des pages vit aussi en base, édité depuis le back office : une
 * ancienne valeur `mailto:` peut donc revenir sans passer par le dépôt. On
 * normalise à la lecture plutôt que de compter sur la saisie.
 *
 * Seuls les liens de type `href` sont réécrits : l'adresse affichée en clair
 * (pied de page, mentions légales, page contact) garde son `mailto:`.
 */
const UNSAFE = /^(javascript|data|vbscript|file):/i;

export function contactLinks<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => contactLinks(item)) as unknown as T;
  }
  if (value === null || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === "href" && typeof item === "string") {
      const href = item.trim();
      if (UNSAFE.test(href)) {
        // Un href piloté par la base ne doit jamais exécuter de script.
        out[key] = routes.contact;
        continue;
      }
      if (href.toLowerCase().startsWith("mailto:")) {
        out[key] = routes.contact;
        continue;
      }
    }
    out[key] = contactLinks(item);
  }
  return out as unknown as T;
}
