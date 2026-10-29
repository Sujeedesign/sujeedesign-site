import homeJson from "@/content/home.json";
import servicesJson from "@/content/services.json";
import { homeSchema, type HomeContent } from "@/lib/content/schema";

/**
 * Contenu servi en ligne, sans rebuild.
 *
 * Le JSON versionné n'est plus la seule source : à chaque génération de page, on
 * interroge `/api/v1/content/<slug>` du back office. Le résultat est mis en cache
 * par Next sous le tag `content` ; publier dans l'admin invalide ce tag, et la
 * page suivante est régénérée en tâche de fond (ISR), en quelques secondes.
 *
 * Si l'API est absente ou injoignable, on retombe sur le JSON du dépôt : le site
 * ne casse jamais et `npm run build` garde exactement le même comportement.
 */

const TIMEOUT_MS = 8000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Même fusion que `scripts/pull-content.mjs` : les défauts comblent les trous. */
const merge = (base: unknown, patch: unknown): unknown => {
  if (!isObject(base) || !isObject(patch)) return patch;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = key in base ? merge(base[key], value) : value;
  }
  return out;
};

const fallbackFor = (slug: string): unknown => {
  if (slug === "home") return homeJson;
  if (slug === "services") return servicesJson;
  return null;
};

type ContentSlug = "home" | "services";

async function fetchDocument(slug: string): Promise<unknown | null> {
  const base = (process.env.CONTENT_API_URL || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    const response = await fetch(`${base}/api/v1/content/${slug}`, {
      headers: { accept: "application/json" },
      // Cache Next + tag partagé : la publication back office appelle
      // `revalidateTag("content")` et la page se régénère à la demande.
      next: { tags: ["content", `content:${slug}`], revalidate: 3600 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: unknown };
    if (!isObject(payload?.data)) return null;
    return payload.data;
  } catch {
    // Réseau coupé ou back office en maintenance : on garde le contenu versionné.
    return null;
  }
}

/** Document d'accueil validé par le schéma zod, servi depuis la base si possible. */
export async function getHomeContent(): Promise<HomeContent> {
  const remote = await fetchDocument("home");
  const merged = remote ? merge(fallbackFor("home"), remote) : fallbackFor("home");
  return homeSchema.parse(merged);
}

/** Document des services. Aucun schéma zod exporté pour cette page : le JSON sert de type. */
export async function getServicesContent(): Promise<typeof servicesJson> {
  const remote = await fetchDocument("services");
  const merged = remote ? merge(fallbackFor("services"), remote) : fallbackFor("services");
  return merged as typeof servicesJson;
}
