import { describe, expect, it } from "vitest";
import { coverOf, projects, type Project } from "@/content/projects";

const first: Project = {
  slug: "exemple",
  index: "01",
  name: "Exemple",
  client: "Client",
  disciplines: ["Identité"],
  pitch: "Pitch.",
  scope: "Périmètre.",
  sections: [],
  images: [
    { src: "/assets/img/galerie-1.jpg", alt: "Galerie 1", width: 1600, height: 900 },
    { src: "/assets/img/galerie-2.jpg", alt: "Galerie 2", width: 1600, height: 900 },
  ],
  tags: [],
  tone: "paper",
};

describe("couverture de projet", () => {
  it("replie sur la première image de la galerie quand aucune couverture n'est définie", () => {
    expect(coverOf(first)).toEqual(first.images[0]);
  });

  it("privilégie la couverture dédiée sans toucher à la galerie", () => {
    const cover = { src: "/assets/img/couverture.jpg", alt: "Couverture", width: 2000, height: 1125 };
    const project: Project = { ...first, cover };

    expect(coverOf(project)).toEqual(cover);
    expect(project.images[0]?.src).toBe("/assets/img/galerie-1.jpg");
  });

  it("renvoie undefined quand la galerie est vide et sans couverture", () => {
    expect(coverOf({ ...first, images: [] })).toBeUndefined();
  });

  it("chaque projet publié a une couverture", () => {
    for (const project of projects) {
      expect(coverOf(project)?.src).toBeTruthy();
    }
  });
});
