import type { Metadata } from "next";

const SITE = "Sujee Design";
const MAX_DESCRIPTION = 158;

/**
 * Coupe une description à la dernière phrase complète avant la limite.
 *
 * Google tronque vers 160 caractères ; mieux vaut une phrase finie qu'un mot
 * coupé. Si la première phrase dépasse déjà la limite, on recule au dernier
 * espace et on ferme par une ellipse.
 */
export function clipDescription(text: string, max = MAX_DESCRIPTION): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;

  const sentences = clean.match(/[^.!?]+[.!?]+/g) ?? [];
  let kept = "";
  for (const sentence of sentences) {
    if ((kept + sentence).trim().length > max) break;
    kept += sentence;
  }
  if (kept.trim().length >= 80) return kept.trim();

  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 0 ? space : max - 1).trimEnd()}…`;
}

/**
 * Métadonnées d'une page intérieure.
 *
 * Les titres des fichiers v5 portent déjà le suffixe « — Sujee Design » ; le gabarit du
 * layout l'ajoute aussi. On le retire ici pour éviter un doublon, et on déclare le
 * canonical, l'image de partage et les cartes sociales de la page.
 */
export function pageMetadata(
  meta: { title: string; description: string },
  path: string,
  image = "/assets/img/og/studio.jpg",
): Metadata {
  const title =
    meta.title.replace(/\s*[—–·|-]\s*Sujee Design\s*$/u, "").trim() || meta.title;
  const description = clipDescription(meta.description);
  const socialTitle = title.includes(SITE) ? title : `${title} — ${SITE}`;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE,
      locale: "fr_FR",
      title: socialTitle,
      description,
      url: path,
      images: [{ url: image, width: 1200, height: 630, alt: socialTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image],
    },
  };
}
