import { COVER_PORTRAIT_MEDIA, coverFor, type Project } from "@/content/projects";

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
 * Sous 720 px de large, le navigateur prend la couverture portrait ; au-dessus,
 * la paysage. Le choix est fait par le navigateur sur `media` : une seule des
 * deux images est téléchargée, et le rendu reste correct sans JavaScript.
 *
 * Un projet sans `coverPortrait` n'émet aucune `<source>` : il retombe sur la
 * couverture paysage, exactement comme avant. `coverOf()` n'est pas modifiée.
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

  return (
    <picture data-cover-portrait={hasPortrait ? "" : undefined}>
      {hasPortrait ? <source media={COVER_PORTRAIT_MEDIA} srcSet={portrait.src} /> : null}
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
