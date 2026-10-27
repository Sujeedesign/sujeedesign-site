import homeData from "./home.json";
import { homeSchema, type HomeContent } from "@/lib/content/schema";

/**
 * Contenu de l'accueil.
 *
 * Les valeurs vivent dans `home.json` : c'est le même fichier que lit le back
 * office pour proposer ses formulaires. Au build, `scripts/pull-content.mjs`
 * remplace ce fichier par la version enregistrée dans l'admin (si l'API répond),
 * donc une publication suffit à mettre le site à jour, sans toucher au code.
 *
 * Le schéma zod sert de garde-fou : un contenu incomplet casse le build plutôt
 * que d'afficher une page trouée.
 */
export const homeContent: HomeContent = homeSchema.parse(homeData);
