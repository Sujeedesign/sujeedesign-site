import type { Metadata } from "next";

/**
 * Métadonnées d'une page intérieure.
 *
 * Les titres des fichiers v5 portent déjà le suffixe « — Sujee Design » ; le gabarit du
 * layout l'ajoute aussi. On le retire ici pour éviter un doublon, et on déclare le
 * canonical ainsi que les cartes sociales de la page.
 */
export function pageMetadata(
  meta: { title: string; description: string },
  path: string,
): Metadata {
  const title = meta.title.replace(/\s*[—–-]\s*Sujee Design\s*$/u, "").trim() || meta.title;
  const description = meta.description;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}
