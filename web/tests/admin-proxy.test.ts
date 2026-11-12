import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

/**
 * Depuis le 12/11, le back office est servi sur son propre domaine
 * (`admin.sujeedesign.com`). L'apex ne doit plus relayer ses pages, ses API ni
 * ses assets : il redirige, et n'expose que les données que le site public
 * consomme (/medias, agent de contact, barre d'édition, suivi de propositions).
 *
 * Une rewrite supprimée par erreur ne casse pas le build : /admin retomberait
 * simplement en 404. On verrouille donc le contrat ici.
 */
describe("back office hors de l'apex", () => {
  const rewrites = async () => {
    const rules = await nextConfig.rewrites?.();
    if (!rules || Array.isArray(rules)) throw new Error("rewrites attendues sous forme d'objet");
    return new Map((rules.beforeFiles ?? []).map((rule) => [rule.source, rule.destination]));
  };

  const redirects = async () => {
    const rules = (await nextConfig.redirects?.()) ?? [];
    return new Map(rules.map((rule) => [rule.source, rule.destination]));
  };

  it("redirige les pages d'administration vers le sous-domaine", async () => {
    const rules = await redirects();
    expect(rules.get("/admin")).toBe("https://admin.sujeedesign.com/admin");
    expect(rules.get("/admin/:path*")).toBe("https://admin.sujeedesign.com/admin/:path*");
  });

  it("ne relaie plus aucune page, API ni asset d'administration", async () => {
    const rules = await rewrites();
    for (const gone of [
      "/admin",
      "/admin/:path*",
      "/api/admin/:path*",
      "/static-admin/:path*",
      "/bo/assets/:path*",
      "/assets/admin.css",
      "/assets/admin.js",
      "/assets/editor/:path*",
      "/assets/projects/:path*",
      "/assets/fonts/:path*",
      "/assets/logo-sujeepan-sabesan.svg",
      "/assets/icon_sujeepansabesan.svg",
    ]) {
      expect(rules.has(gone), gone).toBe(false);
    }
  });

  it("garde les données consommées par le site public", async () => {
    const rules = await rewrites();
    for (const kept of ["/medias/:path*", "/api/agent/:path*", "/api/editor/:path*", "/api/track/:path*"]) {
      expect(rules.has(kept), kept).toBe(true);
      expect(rules.get(kept), kept).toContain("admin.sujeedesign.com");
    }
  });

  it("n'avale pas les assets propres au site", async () => {
    const rules = await rewrites();
    expect(rules.has("/assets/:path*")).toBe(false);
    expect(rules.has("/assets/site.css")).toBe(false);
    expect(rules.has("/assets/site.js")).toBe(false);
  });

  /** Le back office ne doit jamais apparaître dans les résultats de recherche. */
  it("marque le back office en noindex", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    for (const source of ["/admin", "/admin/:path*"]) {
      const rule = rules.find((r) => r.source === source);
      expect(rule, source).toBeDefined();
      const robots = rule?.headers.find((h) => h.key === "X-Robots-Tag");
      expect(robots?.value, source).toContain("noindex");
    }
  });

  /** L'éditeur intégré affiche le site en iframe : l'ancêtre doit être autorisé. */
  it("autorise l'aperçu du site depuis le domaine d'administration", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const global = rules.find((r) => r.source === "/:path*");
    const csp = global?.headers.find((h) => h.key === "Content-Security-Policy");
    expect(csp?.value).toContain("frame-ancestors");
    expect(csp?.value).toContain("https://admin.sujeedesign.com");
    expect(csp?.value).not.toContain("frame-ancestors *");
  });
});
