import { COVER_PORTRAIT_MEDIA, coverFor, type Project } from "@/content/projects";
import { webpSrcSet } from "@/lib/images";

type CoverPictureProps = {
  project: Project;
  /**
   * Texte alternatif. Par défaut celui de la couverture paysage ; passer `""`
   * pour une image décorative (fond de carte, vignette purement illustrative).
   */
  alt?: string;
  className?: string;
  /** `eager` pour les visuels au-dessus de la ligne de flottaison. */
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  /** Indication de largeur rendue, quand le conteneur ne fait pas 100vw. */
  sizes?: string;
};

/**
 * Couverture de projet servie en `<picture>`.
 *
 * Deux décisions indépendantes y sont prises par le navigateur :
 *
 * 1. Le format : les sources WebP passent en premier, le JPEG reste le repli.
 *    Chaque format est décliné en 480, 960 et 1600 px, donc le mobile ne
 *    télécharge plus l'image pleine largeur.
 * 2. Le cadrage : sous 720 px, la couverture portrait ; au-dessus, la paysage.
 *
 * Un projet sans `coverPortrait` n'émet aucune `<source>` mobile : il retombe
 * sur la couverture paysage, exactement comme avant.
 */
export function CoverPicture({
  project,
  alt,
  className,
  loading,
  fetchPriority,
  sizes,
}: CoverPictureProps) {
  const landscape = coverFor(project, "landscape");
  const portrait = coverFor(project, "portrait");
  if (!landscape) return null;

  // `coverFor` replie le portrait sur la paysage : une source identique
  // n'apporterait rien et forcerait un second téléchargement.
  const hasPortrait = portrait !== undefined && portrait.src !== landscape.src;

  const landscapeWebp = webpSrcSet(landscape.src);
  const portraitWebp = portrait ? webpSrcSet(portrait.src) : undefined;

  return (
    <picture data-cover-portrait={hasPortrait ? "" : undefined}>
      {hasPortrait && portraitWebp ? (
        <source
          media={COVER_PORTRAIT_MEDIA}
          type="image/webp"
          srcSet={portraitWebp}
          sizes={sizes}
        />
      ) : null}
      {hasPortrait && portrait ? (
        <source media={COVER_PORTRAIT_MEDIA} srcSet={portrait.src} />
      ) : null}
      {landscapeWebp ? <source type="image/webp" srcSet={landscapeWebp} sizes={sizes} /> : null}
      <img
        src={landscape.src}
        alt={alt ?? landscape.alt}
        width={landscape.width}
        height={landscape.height}
        className={className}
        loading={loading}
        fetchPriority={fetchPriority}
        sizes={sizes}
        decoding="async"
      />
    </picture>
  );
}
