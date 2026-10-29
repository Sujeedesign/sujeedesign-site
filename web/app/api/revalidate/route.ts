import { revalidateTag } from "next/cache";

/**
 * Invalidation du cache de contenu après une publication dans le back office.
 *
 * Le back office appelle cette route en POST avec l'en-tête `x-revalidate-secret`.
 * Sans secret configuré, la route refuse tout : elle ne doit jamais être ouverte,
 * sinon n'importe qui pourrait forcer des régénérations.
 */
export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET || "";
  const given = request.headers.get("x-revalidate-secret") || "";
  if (!expected || given !== expected) {
    return Response.json({ ok: false, error: "non autorisé" }, { status: 401 });
  }
  // `content` couvre les deux pages servies en direct (`home`, `services`).
  revalidateTag("content");
  return Response.json({ ok: true, revalidated: "content", now: Date.now() });
}
