import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverPicture } from "@/components/CoverPicture";
import type { Project } from "@/content/projects";

const base: Project = {
  slug: "exemple",
  index: "01",
  name: "Exemple",
  client: "Client",
  disciplines: ["Identité"],
  pitch: "Pitch.",
  scope: "Périmètre.",
  sections: [],
  cover: { src: "/assets/img/cover.jpg", alt: "Couverture paysage", width: 1920, height: 1280 },
  images: [{ src: "/assets/img/galerie-1.jpg", alt: "Galerie 1", width: 1600, height: 900 }],
  tags: [],
  tone: "paper",
};

const portrait = {
  src: "/assets/img/projet-exemple/cover-portrait.jpg",
  alt: "Couverture portrait",
  width: 1080,
  height: 1920,
};

describe("CoverPicture", () => {
  it("émet un <source> mobile quand le projet a une couverture portrait", () => {
    const { container } = render(<CoverPicture project={{ ...base, coverPortrait: portrait }} />);

    const source = container.querySelector("picture > source");
    expect(source?.getAttribute("media")).toBe("(max-width: 720px)");
    expect(source?.getAttribute("srcset")).toBe(portrait.src);

    const img = container.querySelector("picture > img");
    expect(img?.getAttribute("src")).toBe(base.cover?.src);
    expect(img?.getAttribute("width")).toBe("1920");
  });

  it("n'émet aucune <source> sans visuel portrait, pour ne rien télécharger en plus", () => {
    const { container } = render(<CoverPicture project={base} />);

    expect(container.querySelector("picture > source")).toBeNull();
    expect(container.querySelector("picture")?.hasAttribute("data-cover-portrait")).toBe(false);
    expect(container.querySelector("picture > img")?.getAttribute("src")).toBe(base.cover?.src);
  });

  it("replie sur la couverture paysage quand le portrait pointe sur le même fichier", () => {
    const { container } = render(
      <CoverPicture project={{ ...base, coverPortrait: { ...portrait, src: base.cover!.src } }} />,
    );

    expect(container.querySelector("picture > source")).toBeNull();
  });

  it("reprend l'alt de la couverture et respecte un alt vide", () => {
    const { container, unmount } = render(<CoverPicture project={base} />);
    expect(container.querySelector("picture > img")?.getAttribute("alt")).toBe("Couverture paysage");

    unmount();
    const decorated = render(<CoverPicture project={base} alt="" />);
    expect(decorated.container.querySelector("picture > img")?.getAttribute("alt")).toBe("");
  });

  it("ne rend rien quand le projet n'a ni couverture ni galerie", () => {
    const { container } = render(<CoverPicture project={{ ...base, cover: undefined, images: [] }} />);
    expect(container.innerHTML).toBe("");
  });
});
