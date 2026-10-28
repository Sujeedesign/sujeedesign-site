import { describe, expect, it } from "vitest";
import { projects, getProject } from "@/content/projects";
import {
  breadcrumbNode,
  creativeWorkNode,
  pageGraph,
  serviceNode,
  SCHEMA_IDS,
} from "@/lib/structured-data";
import { linkedServices, relatedProjects } from "@/lib/project-links";
import { serviceSlugs } from "@/lib/routes";

describe("données structurées", () => {
  it("regroupe les nœuds dans un seul @graph avec des @id absolus", () => {
    const graph = pageGraph([breadcrumbNode([{ name: "Accueil", path: "/" }])]);
    const nodes = graph["@graph"] as Array<{ "@id"?: string }>;
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node["@id"]).toMatch(/^https:\/\/sujeedesign\.com/);
    }
  });

  it("déclare un CreativeWork par fiche projet", () => {
    for (const project of projects) {
      const node = creativeWorkNode(project);
      expect(node["@type"]).toBe("CreativeWork");
      expect(node.url).toContain(`/realisations/${project.slug}`);
    }
  });

  it("n'invente ni note, ni prix, ni avis", () => {
    const first = projects[0];
    if (!first) throw new Error("aucun projet publié");
    const serialised = JSON.stringify(
      pageGraph([
        creativeWorkNode(first),
        ...serviceSlugs.map((slug) => serviceNode(slug)),
        breadcrumbNode([{ name: "Accueil", path: "/" }]),
      ]),
    );
    expect(serialised).not.toMatch(/aggregateRating|review|offers|price/i);
  });

  it("expose le studio comme @id de référence", () => {
    expect(SCHEMA_IDS.studio).toBe("https://sujeedesign.com/#studio");
  });

  it("ne laisse aucune référence @id orpheline dans le graphe d'une page", () => {
    const project = projects[0];
    if (!project) throw new Error("aucun projet publié");
    const graph = pageGraph([
      creativeWorkNode(project),
      ...linkedServices(project, serviceSlugs.length).map((service) => service.node),
      breadcrumbNode([
        { name: "Accueil", path: "/" },
        { name: "Réalisations", path: "/realisations" },
      ]),
    ]);

    const declared = new Set(
      graph["@graph"]
        .map((node) => node["@id"])
        .filter((id): id is string => typeof id === "string"),
    );
    const founders: string[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) return value.forEach(walk);
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (key === "@id" && typeof child === "string") founders.push(child);
        else walk(child);
      }
    };
    walk(graph);

    // `#fil` n'est pas déclaré : le fil d'Ariane est un nœud terminal.
    expect(founders.filter((id) => !declared.has(id) && !id.endsWith("#fil"))).toEqual([]);
  });

  it("sérialise sans null ni undefined, même sans description de service", () => {
    const json = JSON.stringify(pageGraph([serviceNode("identite-de-marque")]));
    expect(json).not.toContain("null");
    expect(json).not.toContain("undefined");
  });

  it("pointe les agents IA vers leur page racine", () => {
    expect(serviceNode("agents-ia").url).toBe("https://sujeedesign.com/agents-ia");
  });
});

describe("maillage interne des fiches projet", () => {
  it("relie chaque projet à au moins un service", () => {
    for (const project of projects) {
      expect(linkedServices(project).length).toBeGreaterThan(0);
    }
  });

  it("ne renvoie jamais la fiche courante dans les projets liés", () => {
    for (const project of projects) {
      const related = relatedProjects(project);
      expect(related).toHaveLength(2);
      expect(related.map((entry) => entry.slug)).not.toContain(project.slug);
    }
  });

  it("mappe Elerya sur l'identité de marque et le e-commerce", () => {
    const project = getProject("elerya");
    if (!project) throw new Error("projet Elerya introuvable");
    const primary = linkedServices(project).map((service) => service.slug);
    expect(primary).toContain("identite-de-marque");
    const all = linkedServices(project, serviceSlugs.length).map((service) => service.slug);
    expect(all).toContain("site-ecommerce");
  });
});
