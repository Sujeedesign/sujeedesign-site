import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { site } from "@/content/site";
import {
  PAGE_UPDATED,
  PROJECTS_UPDATED,
  SERVICE_UPDATED,
  contentUpdated,
  projectsUpdated,
} from "@/lib/content/freshness";
import { realisationPath, routes, serviceHref, serviceSlugs } from "@/lib/routes";
import { studioNode, websiteNode } from "@/lib/structured-data";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const NOON_UTC = "T12:00:00.000Z";

const asIso = (value: unknown): string => new Date(value as Date).toISOString();

describe("signaux SEO du plan de site et du nom de site", () => {
  it("date chaque URL séparément, avec des lastmod réellement distincts", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const stamps = entries.map((entry) => {
      expect(entry.lastModified).toBeDefined();
      const iso = asIso(entry.lastModified);
      // Ancrage à midi UTC : aucun décalage de fuseau d'un rendu à l'autre.
      expect(iso.endsWith(NOON_UTC)).toBe(true);
      return iso;
    });

    // Le point du correctif : le plan de site ne porte plus une date unique.
    expect(new Set(stamps).size).toBeGreaterThanOrEqual(2);
  });

  it("n'annonce aucune date future et reste stable d'un appel à l'autre", async () => {
    const first = (await sitemap()).map((entry) => asIso(entry.lastModified));
    const second = (await sitemap()).map((entry) => asIso(entry.lastModified));
    expect(second).toEqual(first);

    const now = Date.now();
    for (const stamp of first) {
      expect(new Date(stamp).getTime()).toBeLessThanOrEqual(now);
    }
  });

  it("couvre chaque route statique et chaque fiche service, sans date fantôme", async () => {
    const entries = await sitemap();
    const urls = new Set(entries.map((entry) => new URL(entry.url).pathname));
    const lastmodOf = (path: string) =>
      asIso(entries.find((entry) => new URL(entry.url).pathname === path)?.lastModified);

    for (const path of Object.values(routes)) {
      expect(urls.has(path)).toBe(true);
      expect(lastmodOf(path)).toBe(new Date(`${PAGE_UPDATED[path as keyof typeof PAGE_UPDATED]}${NOON_UTC}`).toISOString());
    }

    for (const slug of serviceSlugs) {
      const path = serviceHref(slug);
      // `/agents-ia` est une page statique : sa date vient de `PAGE_UPDATED`.
      if (slug === "agents-ia") continue;
      expect(lastmodOf(path)).toBe(
        new Date(`${SERVICE_UPDATED[slug as keyof typeof SERVICE_UPDATED]}${NOON_UTC}`).toISOString(),
      );
    }
  });

  it("date les fiches réalisations depuis le catalogue, à midi UTC", async () => {
    const entries = await sitemap();
    const projects = entries.filter((entry) => entry.url.includes(realisationPath("").slice(0, -1) + "/"));
    expect(projects.length).toBeGreaterThan(0);

    const expected = projectsUpdated().toISOString();
    for (const entry of projects) {
      expect(asIso(entry.lastModified)).toBe(expected);
    }
    expect(PROJECTS_UPDATED).toMatch(ISO_DAY);
  });

  it("garde toutes les dates déclarées au format ISO et jamais dans le futur", () => {
    const now = Date.now();
    const all = [
      ...Object.values(PAGE_UPDATED),
      ...Object.values(SERVICE_UPDATED),
      PROJECTS_UPDATED,
      contentUpdated().toISOString().slice(0, 10),
    ];

    for (const day of all) {
      expect(day).toMatch(ISO_DAY);
      const at = new Date(`${day}${NOON_UTC}`).getTime();
      expect(Number.isNaN(at)).toBe(false);
      expect(at).toBeLessThanOrEqual(now);
    }

    // La date figée dans le code ne suit pas l'horloge.
    expect(Date.now() - contentUpdated().getTime()).toBeGreaterThan(60_000);
  });

  it("nomme le site et déclare ses variantes dans le graphe JSON-LD", () => {
    expect(site.name).toBe("Sujee Design");
    expect(site.alternateName).toContain("Sujeedesign");

    const website = websiteNode();
    expect(website["@type"]).toBe("WebSite");
    expect(website.name).toBe("Sujee Design");
    expect(website.alternateName).toEqual(site.alternateName);

    const studio = studioNode();
    expect(studio.name).toBe("Sujee Design");
    expect(studio.alternateName).toEqual(site.alternateName);
  });
});
