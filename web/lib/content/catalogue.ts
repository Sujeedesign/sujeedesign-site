import { projects as staticProjects, type Project } from "@/content/projects";

/**
 * Catalogue des réalisations servi par le back office.
 *
 * La base est la seule source depuis la bascule du 2 novembre 2026 : une fiche
 * publiée dans l'admin apparaît ici, une fiche retirée disparaît. Le fichier
 * `content/projects.ts` reste la graine de la première migration et le repli si
 * l'API ne répond pas : le site ne peut pas se retrouver vide.
 *
 * Cache Next sous le tag `catalogue` ; publier dans l'admin appelle
 * `revalidateTag("catalogue")` et les pages concernées se régénèrent.
 */

const TIMEOUT_MS = 8000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown): string => (typeof value === "string" ? value : "");

const image = (value: unknown): Project["images"][number] | null => {
  if (!isObject(value) || !text(value.src)) return null;
  return {
    src: text(value.src),
    alt: text(value.alt),
    width: Number(value.width) || 0,
    height: Number(value.height) || 0,
  };
};

const images = (value: unknown): Project["images"] =>
  Array.isArray(value) ? value.map(image).filter((entry): entry is Project["images"][number] => entry !== null) : [];

const sections = (value: unknown): Project["sections"] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isObject(entry)) return [];
        const paragraphs = Array.isArray(entry.paragraphs) ? entry.paragraphs.map(text).filter(Boolean) : [];
        const bullets = Array.isArray(entry.bullets) ? entry.bullets.map(text).filter(Boolean) : [];
        return [
          {
            k: text(entry.k),
            label: text(entry.label),
            title: text(entry.title),
            paragraphs,
            ...(bullets.length ? { bullets } : {}),
          },
        ];
      })
    : [];

const results = (value: unknown): Project["results"] =>
  Array.isArray(value)
    ? value.flatMap((entry) => {
        if (!isObject(entry) || !text(entry.value)) return [];
        return [{ value: text(entry.value), label: text(entry.label) }];
      })
    : undefined;

/** Fiche normalisée depuis la réponse publique. `null` si elle est inexploitable. */
function toProject(value: unknown): Project | null {
  if (!isObject(value)) return null;
  const slug = text(value.slug);
  const name = text(value.name);
  if (!slug || !name) return null;

  const tone = value.tone;
  const cover = image(value.cover) ?? undefined;
  const list = images(value.images);
  const res = results(value.results);

  return {
    slug,
    index: text(value.index) || "00",
    name,
    client: text(value.client),
    ...(text(value.year) ? { year: text(value.year) } : {}),
    ...(text(value.city) ? { city: text(value.city) } : {}),
    disciplines: Array.isArray(value.disciplines) ? value.disciplines.map(text).filter(Boolean) : [],
    pitch: text(value.pitch),
    scope: text(value.scope),
    ...(text(value.duration) ? { duration: text(value.duration) } : {}),
    sections: sections(value.sections),
    ...(res && res.length ? { results: res } : {}),
    ...(cover ? { cover } : {}),
    images: list,
    tags: Array.isArray(value.tags) ? value.tags.map(text).filter(Boolean) : [],
    tone: tone === "tint" || tone === "dark" ? tone : "paper",
  };
}

/** Catalogue publié, ou les fiches du dépôt si le back office est injoignable. */
export async function getProjects(): Promise<Project[]> {
  const base = (process.env.CONTENT_API_URL || "").trim().replace(/\/+$/, "");
  if (!base) return staticProjects;
  try {
    const response = await fetch(`${base}/api/v1/catalogue`, {
      headers: { accept: "application/json" },
      next: { tags: ["catalogue"], revalidate: 3600 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return staticProjects;
    const payload = (await response.json()) as { projects?: unknown };
    if (!Array.isArray(payload.projects)) return staticProjects;
    const list = payload.projects.map(toProject).filter((entry): entry is Project => entry !== null);
    // Base encore vide (premier démarrage) : on garde les fiches du dépôt.
    return list.length ? list : staticProjects;
  } catch {
    return staticProjects;
  }
}

export function findProject(list: Project[], slug: string): Project | undefined {
  return list.find((project) => project.slug === slug);
}

export function nextProjectIn(list: Project[], slug: string): Project | undefined {
  const index = list.findIndex((project) => project.slug === slug);
  if (index === -1) return list[0];
  return list[(index + 1) % list.length] ?? list[0];
}
