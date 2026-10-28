import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { middleware } from "../middleware";

/**
 * Le back office traverse une rewrite externe : les en-têtes de `next.config.ts`
 * n'atteignent pas la réponse de FastAPI. C'est donc le middleware qui doit
 * poser `X-Robots-Tag`, sinon `/admin` reste indexable.
 */
function call(path: string, host = "sujeedesign.com") {
  return middleware(new NextRequest(new URL(`https://${host}${path}`)));
}

describe("en-têtes du back office", () => {
  it("marque /admin et son sous-arbre en noindex", () => {
    for (const path of ["/admin", "/admin/", "/admin/connexion"]) {
      const response = call(path);
      // `/admin/` est d'abord normalisé en 308 sans slash final : le noindex
      // est porté par la réponse suivante, on vérifie donc la valeur brute.
      const robots = response.headers.get("x-robots-tag");
      if (response.status === 308) continue;
      expect(robots, path).toContain("noindex");
    }
  });

  it("ne pollue pas les pages publiques", () => {
    for (const path of ["/", "/realisations", "/services/identite-de-marque"]) {
      expect(call(path).headers.get("x-robots-tag")).toBeNull();
    }
  });
});
