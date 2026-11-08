import { describe, expect, it, vi } from "vitest";

import sitemap from "@/app/sitemap";
import { site } from "@/content/site";
import {
  PAGE_UPDATED,
  PROJECTS_UPDATED,
  SERVICE_UPDATED,
  contentUpdated,
  projectUpdated,
  projectsUpdated,
} from "@/lib/content/freshness";
import { realisationPath, routes, serviceHref, serviceSlugs } from "@/lib/routes";
import { studioNode, websiteNode } from "@/lib/structured-data";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const NOON_UTC = "T12:00:00.000Z";

const asIso = (value: unknown): string => new Date(value as Date).toISOString();

/**
 * Jour calendaire d'un instant, vu de Paris.
 *
 * Les dates éditoriales sont ancrées à midi UTC : elles désignent un *jour*,
 * pas un instant. Comparer `stamp <= Date.now()` revient donc à exiger midi
 * déjà passé, et faisait échouer la suite chaque matin où une date du jour est
 * publiée. On compare désormais le jour de Paris de la date déclarée à celui de
 * l'horloge : une date du jour est valide dès 00:00 à Paris, et rien de
 * strictement postérieur au jour courant ne passe.
 */
const PARIS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const parisDay = (value: Date | number | string): string =>
  PARIS_DAY.format(value instanceof Date ? value : new Date(value));

/** Jour courant à Paris, `AAAA-MM-JJ` (comparable lexicographiquement). */
const todayInParis = (): string => parisDay(Date.now());

/** Vrai si la date n'annonce aucun jour postérieur à aujourd'hui (Paris). */
const isNotAfterToday = (value: Date | number | string, today = todayInParis()): boolean =>
  parisDay(value) <= today;

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

    // Comparaison au jour près : une date du jour reste valide avant midi UTC,
    // aucune date d'un jour ultérieur ne passe.
    const today = todayInParis();
    for (const stamp of first) {
      expect(isNotAfterToday(stamp, today)).toBe(true);
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

  it("date les fiches réalisations à midi UTC, et retombe sur le repli sans updated_at", async () => {
    // Sans back office joignable, le plan de site lit la graine du dépôt : aucune
    // fiche n'a d'`updated_at`, toutes prennent donc la date de repli.
    const previous = process.env.CONTENT_API_URL;
    delete process.env.CONTENT_API_URL;
    try {
      const entries = await sitemap();
      const projects = entries.filter((entry) => entry.url.includes(realisationPath("").slice(0, -1) + "/"));
      expect(projects.length).toBeGreaterThan(0);

      const expected = projectsUpdated().toISOString();
      for (const entry of projects) {
        expect(asIso(entry.lastModified)).toBe(expected);
      }
      expect(PROJECTS_UPDATED).toMatch(ISO_DAY);
    } finally {
      if (previous === undefined) delete process.env.CONTENT_API_URL;
      else process.env.CONTENT_API_URL = previous;
    }
  });

  it("prend le lastmod de chaque fiche dans l'updated_at du catalogue", async () => {
    // Deux fiches datées différemment et une fiche sans date : le plan de site
    // doit suivre la donnée du back office, fiche par fiche.
    const previous = process.env.CONTENT_API_URL;
    process.env.CONTENT_API_URL = "https://admin.exemple";
    vi.stubGlobal("fetch", async () =>
      ({
        ok: true,
        json: async () => ({
          projects: [
            { slug: "club-med", name: "Club Med — TEd", updated_at: "2026-10-02" },
            { slug: "dekra", name: "Dekra", updated_at: "2026-10-21" },
            { slug: "logofolio", name: "Logofolio" },
          ],
        }),
      }) as unknown as Response,
    );

    try {
      const entries = await sitemap();
      const lastmodOf = (slug: string) =>
        asIso(entries.find((entry) => new URL(entry.url).pathname === realisationPath(slug))?.lastModified);

      const attendu = (day: string) => new Date(`${day}${NOON_UTC}`).toISOString();
      expect(lastmodOf("club-med")).toBe(attendu("2026-10-02"));
      expect(lastmodOf("dekra")).toBe(attendu("2026-10-21"));
      // Fiche sans date : repli, inchangé.
      expect(lastmodOf("logofolio")).toBe(projectsUpdated().toISOString());
    } finally {
      vi.unstubAllGlobals();
      if (previous === undefined) delete process.env.CONTENT_API_URL;
      else process.env.CONTENT_API_URL = previous;
    }
  });

  it("plafonne une date éditoriale future et ignore une date illisible", () => {
    const future = projectUpdated({ updatedAt: "2999-01-01" });
    expect(isNotAfterToday(future)).toBe(true);
    expect(future.toISOString().endsWith(NOON_UTC)).toBe(true);

    expect(projectUpdated({ updatedAt: "2026-13-45" }).toISOString()).toBe(projectsUpdated().toISOString());
    expect(projectUpdated({}).toISOString()).toBe(projectsUpdated().toISOString());
  });

  it("ne publie aucune URL en double, notamment /agents-ia", async () => {
    const entries = await sitemap();
    expect(new Set(entries.map((e) => e.url)).size).toBe(entries.length);
  });

  it("garde toutes les dates déclarées au format ISO et jamais dans le futur", () => {
    const today = todayInParis();
    const all = [
      ...Object.values(PAGE_UPDATED),
      ...Object.values(SERVICE_UPDATED),
      PROJECTS_UPDATED,
      contentUpdated().toISOString().slice(0, 10),
    ];

    for (const day of all) {
      expect(day).toMatch(ISO_DAY);
      // La date déclarée désigne un jour : c'est ce jour, et pas son midi,
      // qu'on compare au jour courant à Paris.
      const noonUtc = new Date(`${day}${NOON_UTC}`);
      expect(Number.isNaN(noonUtc.getTime())).toBe(false);
      expect(parisDay(noonUtc)).toBe(day);
      expect(isNotAfterToday(noonUtc, today)).toBe(true);
    }

    // La date figée dans le code ne suit pas l'horloge : elle ne coïncide pas
    // avec l'instant présent (comparaison en valeur absolue, pour rester juste
    // aussi le matin avant midi UTC le jour même).
    expect(Math.abs(Date.now() - contentUpdated().getTime())).toBeGreaterThan(60_000);
  });

  it("compare les dates au jour près pour rester verte avant midi UTC", () => {
    // Instant de référence : 08/11/2026 07:32 UTC, la fenêtre qui cassait la CI.
    const matin = new Date("2026-11-08T07:32:00.000Z");
    // Date du jour publiée, ancrée à midi UTC par `freshness.ts`.
    const dateDuJour = new Date(`2026-11-08${NOON_UTC}`);

    // L'ancienne assertion instantanée échouait ici : midi n'était pas passé.
    expect(dateDuJour.getTime()).toBeGreaterThan(matin.getTime());
    // La nouvelle comparaison au jour près l'accepte.
    expect(parisDay(dateDuJour)).toBe("2026-11-08");
    expect(isNotAfterToday(dateDuJour, parisDay(matin))).toBe(true);

    // Elle refuse toujours un jour ultérieur, matin ou après-midi.
    const demain = new Date(`2026-11-09${NOON_UTC}`);
    expect(isNotAfterToday(demain, parisDay(matin))).toBe(false);

    // Et elle tient à cheval sur minuit : 23:30 UTC le 08/11, il est déjà le 09
    // à Paris, donc le 09 n'est plus « futur » mais le 10 le reste.
    const tardLeSoir = new Date("2026-11-08T23:30:00.000Z");
    expect(isNotAfterToday(demain, parisDay(tardLeSoir))).toBe(true);
    expect(isNotAfterToday(new Date(`2026-11-10${NOON_UTC}`), parisDay(tardLeSoir))).toBe(false);
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
