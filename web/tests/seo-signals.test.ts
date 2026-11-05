import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { site } from "@/content/site";
import { CONTENT_UPDATED, contentUpdated } from "@/lib/content/freshness";
import { studioNode, websiteNode } from "@/lib/structured-data";

describe("signaux SEO du plan de site et du nom de site", () => {
  it("déclare un lastModified réel et stable, pas l'heure de la requête", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);

    const expected = contentUpdated().toISOString();
    for (const entry of entries) {
      expect(entry.lastModified).toBeDefined();
      expect(new Date(entry.lastModified as Date).toISOString()).toBe(expected);
    }

    // La date est figée dans le code : elle ne suit pas l'horloge.
    expect(CONTENT_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
