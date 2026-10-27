import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

/**
 * Le back office est servi par un conteneur séparé : si une rewrite disparaît,
 * `/admin` retombe sur le site Next et renvoie 404, sans erreur de build. On
 * verrouille donc le contrat ici.
 */
describe("relais du back office", () => {
  const build = async () => {
    const rewrites = await nextConfig.rewrites?.();
    if (!rewrites || Array.isArray(rewrites)) throw new Error("rewrites attendues sous forme d'objet");
    return new Map((rewrites.beforeFiles ?? []).map((rule) => [rule.source, rule.destination]));
  };

  it("relaie les pages d'administration et leurs actions", async () => {
    const rules = await build();
    expect(rules.get("/admin")).toMatch(/\/admin$/);
    expect(rules.get("/admin/:path*")).toMatch(/\/admin\/:path\*$/);
  });

  it("relaie les API et médias du back office", async () => {
    const rules = await build();
    expect(rules.get("/api/admin/:path*")).toMatch(/\/api\/admin\/:path\*$/);
    // L'éditeur visuel dialogue avec /api/editor (config.api dans visual_page.html).
    expect(rules.get("/api/editor/:path*")).toMatch(/\/api\/editor\/:path\*$/);
    expect(rules.get("/medias/:path*")).toMatch(/\/medias\/:path\*$/);
  });

  it("relaie les assets que le site ne possède pas", async () => {
    const rules = await build();
    for (const asset of [
      "/bo/assets/:path*",
      "/assets/admin.css",
      "/assets/admin.js",
      "/assets/fonts/:path*",
      "/assets/editor/:path*",
      "/assets/projects/:path*",
      "/assets/logo-sujeepan-sabesan.svg",
      "/assets/logo-sujeepan-sabesan-clair.svg",
      "/assets/icon_sujeepansabesan.svg",
    ]) {
      expect(rules.has(asset), asset).toBe(true);
    }
  });

  it("sert les feuilles du thème sous /bo/assets, pas sous /assets", async () => {
    const rules = await build();
    expect(rules.get("/bo/assets/:path*")).toMatch(/\/bo\/assets\/:path\*$/);
    // site.css et site.js existent des deux côtés : le thème passe par /bo/assets
    // pour ne jamais écraser la version Next.
    for (const themed of ["site.css", "site.js", "site-extras.css", "site-v5.css", "site-v5.js", "contact.js"]) {
      expect(rules.has(`/assets/${themed}`), themed).toBe(false);
    }
  });

  it("n'avale pas les assets propres au site", async () => {
    const rules = await build();
    expect(rules.has("/assets/:path*")).toBe(false);
    expect(rules.has("/assets/site.css")).toBe(false);
  });
});
