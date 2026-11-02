/** Variantes WebP générées pour chaque JPEG de `public/assets/img` (voir scripts). */
export const WEBP_WIDTHS = [480, 960, 1600] as const;

/**
 * `srcset` des variantes WebP d'un JPEG, ou `undefined` pour un autre format.
 *
 * Les fichiers sont produits hors build par `scripts/make-webp.js` : chaque
 * `cover.jpg` a ses `cover-480.webp`, `cover-960.webp`, `cover-1600.webp`.
 */
export function webpSrcSet(src: string): string | undefined {
  if (!/\.jpe?g$/i.test(src)) return undefined;
  const base = src.replace(/\.jpe?g$/i, "");
  return WEBP_WIDTHS.map((w) => `${base}-${w}.webp ${w}w`).join(", ");
}
