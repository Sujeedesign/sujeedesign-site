#!/usr/bin/env node
/**
 * Récupère le contenu éditorial enregistré dans le back office et l'écrit dans
 * web/content/<slug>.json, avant le build Next.
 *
 * Le site reste statique : l'API n'est appelée qu'au build. Sans
 * CONTENT_API_URL, le script ne fait rien et le JSON versionné sert de source.
 * Si l'API est configurée mais injoignable, on garde le JSON existant (le
 * build ne doit pas casser pour un back office en maintenance) ; avec
 * CONTENT_STRICT=1, l'échec devient bloquant.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SLUGS = ["home", "services", "realisations", "a-propos", "agents-ia"];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = (process.env.CONTENT_API_URL || "").trim().replace(/\/+$/, "");
const strict = process.env.CONTENT_STRICT === "1";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const merge = (baseDoc, patch) => {
  if (!isObject(baseDoc) || !isObject(patch)) return patch;
  const out = { ...baseDoc };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = key in baseDoc ? merge(baseDoc[key], value) : value;
  }
  return out;
};

/**
 * Même règle que `lib/content/contact-links.ts` : un CTA ne part jamais en
 * `mailto:`, ni vers un schéma exécutable, il ouvre la page contact. La base
 * peut contenir une valeur ancienne ; sans ce filtre, elle revient dans le
 * JSON versionné à chaque build et laisse un diff fantôme que personne n'ose
 * committer.
 */
const CONTACT_HREF = "/contact";
const UNSAFE_HREF = /^(javascript|data|vbscript|file):/i;
let replacedHrefs = 0;

const sanitiseHrefs = (value) => {
  if (Array.isArray(value)) return value.map((item) => sanitiseHrefs(item));
  if (!isObject(value)) return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "href" && typeof item === "string") {
      const href = item.trim();
      if (href.toLowerCase().startsWith("mailto:") || UNSAFE_HREF.test(href)) {
        replacedHrefs += 1;
        out[key] = CONTACT_HREF;
        continue;
      }
    }
    out[key] = sanitiseHrefs(item);
  }
  return out;
};

const fetchDoc = async (slug) => {
  const response = await fetch(`${base}/api/v1/content/${slug}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || !isObject(payload.data)) throw new Error("réponse sans champ data");
  return payload.data;
};

const run = async () => {
  if (!base) {
    console.log("[contenu] CONTENT_API_URL absent : contenu versionné utilisé tel quel.");
    return 0;
  }
  let failed = 0;
  for (const slug of SLUGS) {
    const file = path.join(root, "content", `${slug}.json`);
    const current = JSON.parse(await readFile(file, "utf8"));
    try {
      const remote = await fetchDoc(slug);
      const merged = sanitiseHrefs(merge(current, remote));
      if (replacedHrefs) {
        console.warn(
          `[contenu] ${slug} : ${replacedHrefs} lien(s) mailto remplacé(s) par ${CONTACT_HREF} (CTA vers la page contact).`,
        );
        replacedHrefs = 0;
      }
      const serialised = `${JSON.stringify(merged, null, 2)}\n`;
      if (serialised === `${JSON.stringify(current, null, 2)}\n`) {
        console.log(`[contenu] ${slug} : déjà à jour.`);
      } else {
        await writeFile(file, serialised, "utf8");
        console.log(`[contenu] ${slug} : contenu du back office récupéré.`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`[contenu] ${slug} : ${base} injoignable (${error.message}). JSON existant conservé.`);
    }
  }
  if (failed && strict) {
    console.error("[contenu] CONTENT_STRICT=1 : build interrompu.");
    return 1;
  }
  return 0;
};

process.exitCode = await run();
