import { describe, expect, it } from "vitest";
import {
  COVER_PORTRAIT_MEDIA,
  coverFor,
  coverOf,
  projects,
  type Project,
} from "@/content/projects";

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

describe("couverture portrait", () => {
  const portrait = {
    src: "/assets/img/projet-exemple/cover-portrait.jpg",
    alt: "Portrait",
    width: 1080,
    height: 1350,
  };

  it("sert la couverture portrait avec le point de rupture mobile", () => {
    expect(coverFor({ ...first, coverPortrait: portrait }, "portrait")).toEqual(portrait);
    expect(COVER_PORTRAIT_MEDIA).toBe("(max-width: 720px)");
  });

  it("replie le portrait sur la couverture paysage puis sur la galerie", () => {
    const cover = { src: "/assets/img/couverture.jpg", alt: "Couverture", width: 2000, height: 1125 };

    expect(coverFor({ ...first, cover }, "portrait")).toEqual(cover);
    expect(coverFor(first, "portrait")).toEqual(first.images[0]);
    expect(coverFor({ ...first, images: [] }, "portrait")).toBeUndefined();
  });

  it("ne change rien à la couverture paysage", () => {
    const project: Project = { ...first, coverPortrait: portrait };

    expect(coverFor(project, "landscape")).toEqual(coverOf(project));
    expect(coverFor(project)).toEqual(coverOf(project));
  });

  it("couvre les projets publiés, avec ou sans visuel mobile", () => {
    expect(projects).toHaveLength(9);
    for (const project of projects) {
      const mobile = coverFor(project, "portrait");
      expect(mobile?.src).toBeTruthy();
      // Sans fichier mobile livré, le repli doit rester la couverture paysage.
      if (!project.coverPortrait) expect(mobile).toEqual(coverOf(project));
    }
  });
});
