import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InstagramSection } from "@/components/home/Instagram";
import { getInstagramFeed, type InstagramFeed } from "@/lib/content/instagram";

const feed: InstagramFeed = {
  title: "Sur Instagram",
  intro: "Le fil @sujeedesign.ai.",
  profile: "https://www.instagram.com/sujeedesign.ai/",
  handle: "@sujeedesign.ai",
  posts: [
    {
      id: 1,
      kind: "image",
      src: "/medias/image.jpg",
      poster: "",
      caption: "Identité Vaasam",
      permalink: "https://www.instagram.com/p/AAA/",
      alt: "Identité Vaasam",
    },
    {
      id: 2,
      kind: "video",
      src: "/medias/reel.mp4",
      poster: "/medias/reel.jpg",
      caption: "Coulisses",
      permalink: "",
      alt: "Coulisses",
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete process.env.CONTENT_API_URL;
});

describe("getInstagramFeed", () => {
  it("mappe cinq posts au maximum et ignore les entrées sans source", async () => {
    process.env.CONTENT_API_URL = "https://admin.exemple/";
    const posts = Array.from({ length: 7 }, (_, index) => ({
      id: index,
      kind: index === 0 ? "video" : "image",
      src: `/medias/${index}.jpg`,
      poster: "",
      caption: "",
      permalink: "",
      alt: "",
    }));
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ title: "Fil", posts: [...posts, { id: 99 }] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await getInstagramFeed();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://admin.exemple/api/v1/instagram",
      expect.objectContaining({
        next: expect.objectContaining({ tags: ["instagram"] }),
      }),
    );
    expect(result?.posts).toHaveLength(5);
    expect(result?.posts[0]!.kind).toBe("video");
    expect(result?.title).toBe("Fil");
  });

  it("renvoie null sans API configurée ou quand la grille est vide", async () => {
    expect(await getInstagramFeed()).toBeNull();

    process.env.CONTENT_API_URL = "https://admin.exemple";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ posts: [] }) })),
    );
    expect(await getInstagramFeed()).toBeNull();
  });

  it("renvoie null si l'API est en erreur", async () => {
    process.env.CONTENT_API_URL = "https://admin.exemple";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    expect(await getInstagramFeed()).toBeNull();
  });
});

describe("InstagramSection", () => {
  it("affiche les vignettes et ouvre le player au clic", () => {
    render(<InstagramSection feed={feed} />);

    expect(screen.getByText("Sur Instagram")).toBeTruthy();
    expect(
      screen.getByText("@sujeedesign.ai").closest("a")?.getAttribute("href"),
    ).toBe(feed.profile);

    const tiles = screen
      .getAllByRole("button")
      .filter((node) => node.classList.contains("ig__tile"));
    expect(tiles).toHaveLength(2);
    // la vignette vidéo affiche son poster (fiable même sans codec)
    expect(tiles[1]!.querySelector("img")?.getAttribute("src")).toBe(
      "/medias/reel.jpg",
    );
    expect(tiles[1]!.querySelector(".ig__play")).toBeTruthy();

    fireEvent.click(tiles[0]!);
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe(
      "/medias/image.jpg",
    );
    expect(
      screen
        .getByRole("link", { name: /Voir sur Instagram/ })
        .getAttribute("href"),
    ).toBe("https://www.instagram.com/p/AAA/");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("monte le player dans body pour échapper au contexte d'empilement de la section", () => {
    const { container } = render(<InstagramSection feed={feed} />);
    const tiles = screen
      .getAllByRole("button")
      .filter((node) => node.classList.contains("ig__tile"));

    fireEvent.click(tiles[1]!);
    const dialog = screen.getByRole("dialog");

    // La section porte position:relative + z-index, donc un enfant fixe resterait
    // coincé sous le header collant : le portail doit sortir le player du <section>.
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
    expect(screen.getByRole("button", { name: "Fermer" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("navigue au clavier entre les posts", () => {
    render(<InstagramSection feed={feed} />);
    const tiles = screen
      .getAllByRole("button")
      .filter((node) => node.classList.contains("ig__tile"));

    fireEvent.click(tiles[0]!);
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("dialog").querySelector("video")).toBeTruthy();
    expect(
      screen
        .getByRole("dialog")
        .querySelector("video")
        ?.hasAttribute("controls"),
    ).toBe(true);

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(screen.getByRole("dialog").querySelector("img")).toBeTruthy();
  });

  it("propose un repli quand la vidéo ne peut pas être décodée", () => {
    render(<InstagramSection feed={feed} />);
    const tiles = screen
      .getAllByRole("button")
      .filter((node) => node.classList.contains("ig__tile"));

    fireEvent.click(tiles[1]!);
    const video = screen.getByRole("dialog").querySelector("video");
    fireEvent.error(video!);

    expect(screen.getByRole("dialog").querySelector("video")).toBeNull();
    expect(screen.getByText(/ne peut pas être lue/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ouvrir la vidéo/ })).toBeTruthy();
  });
});
