import { revalidateTag } from "next/cache";

/**
 * Invalidation du cache après une publication dans le back office.
 *
 * Le back office appelle cette route en POST avec l'en-tête `x-revalidate-secret`
 * et un corps `{ "tag": "content" | "catalogue" }`. Sans secret configuré, la
 * route refuse tout : elle ne doit jamais être ouverte, sinon n'importe qui
 * pourrait forcer des régénérations.
 */
const TAGS = new Set(["content", "catalogue"]);

export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET || "";
  const given = request.headers.get("x-revalidate-secret") || "";
  if (!expected || given !== expected) {
    return Response.json({ ok: false, error: "non autorisé" }, { status: 401 });
  }
  let tag = "content";
  try {
    const body = await request.json();
    if (typeof body?.tag === "string" && TAGS.has(body.tag)) tag = body.tag;
  } catch {
    // Corps vide : ancien appelant, on garde le tag historique.
  }
  revalidateTag(tag);
  return Response.json({ ok: true, revalidated: tag, now: Date.now() });
}
