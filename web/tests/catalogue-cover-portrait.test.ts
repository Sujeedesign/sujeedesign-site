import { describe, expect, it } from "vitest";

import { toProject } from "@/lib/content/catalogue";

const portrait = {
  src: "/assets/img/projet/exemple/cover-portrait.jpg",
  alt: "Exemple (mobile)",
  width: 1080,
  height: 1920,
};

const base = {
  slug: "exemple",
  index: "01",
  name: "Exemple",
  cover: { src: "/assets/img/projet/exemple/cover.jpg", alt: "Exemple", width: 1920, height: 1280 },
  images: [],
  tone: "paper",
};

describe("catalogue — couverture portrait", () => {
  it("transmet coverPortrait du back office", () => {
    const project = toProject({ ...base, coverPortrait: portrait });
    expect(project?.coverPortrait).toEqual(portrait);
  });

  it("accepte la forme snake_case de l'API", () => {
    const project = toProject({ ...base, cover_portrait: portrait });
    expect(project?.coverPortrait?.src).toBe(portrait.src);
  });

  it("laisse le champ absent quand le back office n'en envoie pas", () => {
    const project = toProject({ ...base, cover_portrait: "" });
    expect(project).not.toBeNull();
    expect(project && "coverPortrait" in project).toBe(false);
  });

  it("ignore une entrée sans src", () => {
    const project = toProject({ ...base, coverPortrait: { alt: "vide" } });
    expect(project && "coverPortrait" in project).toBe(false);
  });
});
