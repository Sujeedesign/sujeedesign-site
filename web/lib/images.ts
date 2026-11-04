/** Variantes WebP générées pour chaque JPEG de `public/assets/img` (voir scripts). */
export const WEBP_WIDTHS = [480, 960, 1600] as const;

/**
 * `srcset` des variantes WebP d'un JPEG, ou `undefined` pour un autre format.
 *
 * Les fichiers sont produits hors build par `scripts/make-webp.js` : chaque
 * `cover.jpg` a ses `cover-480.webp`, `cover-960.webp`, `cover-1600.webp`.
 */
export function webpSrcSet(src: string, maxWidth?: number): string | undefined {
  if (!/\.jpe?g$/i.test(src)) return undefined;
  const base = src.replace(/\.jpe?g$/i, "");
  // Un master plus étroit que 1600 px (couvertures portrait 1080 px) n'a pas de
  // variante plus large : l'annoncer enverrait le navigateur sur un 404.
  const widths = maxWidth ? WEBP_WIDTHS.filter((w) => w <= maxWidth) : WEBP_WIDTHS;
  if (!widths.length) return undefined;
  return widths.map((w) => `${base}-${w}.webp ${w}w`).join(", ");
}
