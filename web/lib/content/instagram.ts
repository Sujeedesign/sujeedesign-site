/**
 * Grille « Sur Instagram » de l'accueil.
 *
 * Les cinq posts sont choisis à la main dans le back office (import du fichier,
 * légende, lien). Rien n'est récupéré depuis Instagram : si l'API est absente,
 * la section n'est simplement pas rendue.
 */

export type InstagramPost = {
  id: number;
  kind: "image" | "video";
  src: string;
  poster: string;
  caption: string;
  permalink: string;
  alt: string;
};

export type InstagramFeed = {
  title: string;
  intro: string;
  profile: string;
  handle: string;
  posts: InstagramPost[];
};

const TIMEOUT_MS = 8000;

const isPost = (value: unknown): value is InstagramPost => {
  if (!value || typeof value !== "object") return false;
  const post = value as Record<string, unknown>;
  return (
    typeof post.src === "string" &&
    post.src.length > 0 &&
    (post.kind === "image" || post.kind === "video")
  );
};

export async function getInstagramFeed(): Promise<InstagramFeed | null> {
  const base = (process.env.CONTENT_API_URL || "").trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    const response = await fetch(`${base}/api/v1/instagram`, {
      headers: { accept: "application/json" },
      // Tag dédié : enregistrer dans l'admin appelle revalidateTag("instagram").
      next: { tags: ["instagram"], revalidate: 3600 },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<InstagramFeed>;
    const posts = Array.isArray(payload.posts) ? payload.posts.filter(isPost).slice(0, 5) : [];
    if (posts.length === 0) return null;
    return {
      title: typeof payload.title === "string" && payload.title ? payload.title : "Sur Instagram",
      intro: typeof payload.intro === "string" ? payload.intro : "",
      profile:
        typeof payload.profile === "string" && payload.profile
          ? payload.profile
          : "https://www.instagram.com/sujeedesign.ai/",
      handle: typeof payload.handle === "string" && payload.handle ? payload.handle : "@sujeedesign.ai",
      posts,
    };
  } catch {
    return null;
  }
}
