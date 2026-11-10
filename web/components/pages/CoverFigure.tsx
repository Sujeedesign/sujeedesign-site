import styles from "./CoverFigure.module.css";

/**
 * Visuel de couverture dans le corps d'un article.
 *
 * Les masters 1200 × 896 sont déclinés en WebP 480 / 800 / 1200 hors build.
 * Le ratio est porté par `width`/`height` pour que la place soit réservée avant
 * chargement, et l'image reste en `loading="lazy"` : elle est sous le hero, donc
 * jamais LCP.
 */
type Props = {
  slug:
    | "cahier-des-charges"
    | "creer-un-logo"
    | "identite-visuelle"
    | "site-internet"
    | "brief-identite"
    | "testeur-de-logo";
  alt: string;
  caption: string;
};

export function CoverFigure({ slug, alt, caption }: Props) {
  const base = `/assets/img/covers/${slug}`;
  return (
    <figure className={styles.figure}>
      <img
        src={`${base}-1200.webp`}
        srcSet={`${base}-480.webp 480w, ${base}-800.webp 800w, ${base}-1200.webp 1200w`}
        sizes="(max-width: 760px) 92vw, 700px"
        alt={alt}
        width={1200}
        height={896}
        loading="lazy"
        decoding="async"
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
