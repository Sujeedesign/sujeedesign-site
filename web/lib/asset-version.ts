import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Empreinte d'un fichier de `public/` pour versionner son URL.
 *
 * Les CSS du v5 ne portent pas de hash dans leur nom : sans paramètre de version,
 * un `Cache-Control` long servirait l'ancien fichier pendant des semaines. On
 * ajoute donc `?v=<hash>` ; le hash change dès que le contenu change, ce qui
 * rend le cache long sûr.
 *
 * Lecture faite une seule fois par process (build ou serveur standalone).
 */
const cache = new Map<string, string>();

export function assetVersion(file: string): string {
  const cached = cache.get(file);
  if (cached) return cached;

  let version = "";
  try {
    const buffer = readFileSync(path.join(process.cwd(), "public", "assets", file));
    version = createHash("sha1").update(buffer).digest("hex").slice(0, 10);
  } catch {
    // Fichier absent (build partiel, test) : pas de paramètre, l'URL reste valide.
    version = "";
  }
  cache.set(file, version);
  return version;
}

/** URL publique d'un asset versionné. */
export function assetHref(file: string): string {
  const version = assetVersion(file);
  return version ? `/assets/${file}?v=${version}` : `/assets/${file}`;
}
