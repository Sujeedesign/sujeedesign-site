import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { TestContraste, faqItems, pageMeta } from "@/components/pages/TestContraste";
import {
  contrast,
  fixForeground,
  parseHex,
  readableOn,
  relativeLuminance,
  simulate,
  toHex,
  verdict,
} from "@/lib/contrast";
import { routes } from "@/lib/routes";
import sitemap from "@/app/sitemap";

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

describe("lecture des couleurs", () => {
  it("accepte les trois écritures hexadécimales", () => {
    expect(toHex(parseHex("#fff")!)).toBe("#ffffff");
    expect(toHex(parseHex("aabbcc")!)).toBe("#aabbcc");
    expect(toHex(parseHex("#0A0A0B")!)).toBe("#0a0a0b");
  });

  it("refuse une valeur invalide", () => {
    expect(parseHex("#12345")).toBeNull();
    expect(parseHex("bleu")).toBeNull();
    expect(parseHex("#gggggg")).toBeNull();
  });
});

describe("calcul WCAG", () => {
  it("donne 21:1 sur blanc et noir, 1:1 sur la même couleur", () => {
    expect(contrast(WHITE, BLACK)).toBeCloseTo(21, 1);
    expect(contrast(WHITE, WHITE)).toBe(1);
    expect(contrast(BLACK, WHITE)).toBeCloseTo(contrast(WHITE, BLACK), 5);
  });

  it("retrouve les valeurs connues", () => {
    // #767676 sur blanc : 4,54:1, juste au-dessus du seuil AA.
    expect(contrast(parseHex("#767676")!, WHITE)).toBeCloseTo(4.54, 1);
    // #808080 sur blanc : 3,95:1, juste en dessous.
    expect(contrast(parseHex("#808080")!, WHITE)).toBeCloseTo(3.95, 1);
  });

  it("classe les verdicts aux seuils", () => {
    expect(verdict(4.6).aaNormal).toBe(true);
    expect(verdict(4.49).aaNormal).toBe(false);
    expect(verdict(3).aaLarge).toBe(true);
    expect(verdict(7).aaaNormal).toBe(true);
  });

  it("choisit le texte noir ou blanc qui contraste le mieux", () => {
    expect(readableOn(WHITE)).toBe("#0a0a0b");
    expect(readableOn(BLACK)).toBe("#ffffff");
  });
});

describe("correction et simulation", () => {
  it("propose un ton qui atteint 4,5:1 en gardant la teinte", () => {
    const text = parseHex("#b0b0b0")!;
    const fixed = fixForeground(text, WHITE);
    expect(contrast(fixed, WHITE)).toBeGreaterThanOrEqual(4.5);
    // On reste dans les gris : les trois canaux restent à un point près.
    expect(Math.abs(fixed.r - fixed.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(fixed.g - fixed.b)).toBeLessThanOrEqual(1);
  });

  it("propose toujours un ton conforme une fois arrondi", () => {
    const backgrounds = [WHITE, parseHex("#f7f7f5")!, parseHex("#0a0a0b")!, parseHex("#1f2937")!];
    for (let i = 0; i < 32; i += 1) {
      const grey = { r: 120 + i * 4, g: 120 + i * 4, b: 120 + i * 4 };
      for (const bg of backgrounds) {
        const fixed = fixForeground(grey, bg);
        const shown = parseHex(toHex(fixed))!;
        expect(contrast(shown, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("ne touche pas une couleur déjà conforme", () => {
    const text = parseHex("#1a1a1a")!;
    expect(toHex(fixForeground(text, WHITE))).toBe("#1a1a1a");
  });

  it("simule les déficiences sans sortir de la plage 0-255", () => {
    const red = parseHex("#e2412a")!;
    for (const vision of ["protanopie", "deuteranopie", "tritanopie", "achromatopsie"] as const) {
      const out = simulate(red, vision);
      expect(out.r).toBeGreaterThanOrEqual(0);
      expect(out.r).toBeLessThanOrEqual(255);
      expect(Number.isFinite(out.g)).toBe(true);
    }
    // L'achromatopsie ramène les trois canaux au même niveau.
    const grey = simulate(red, "achromatopsie");
    expect(toHex(grey).slice(1, 3)).toBe(toHex(grey).slice(3, 5));
  });

  it("garde la luminance entre 0 et 1", () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 5);
  });
});

describe("page de test de contraste", () => {
  it("rend un seul h1, les seuils et la FAQ", () => {
    const { container } = render(<TestContraste />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("details")).toHaveLength(faqItems.length);
    expect(container.querySelector("table")).toBeTruthy();
    expect(container).toHaveTextContent("Seuils de contraste");
    expect(container).toHaveTextContent("3:1");
  });

  it("garde un titre et une description dans les limites SEO", () => {
    expect(pageMeta.title.length).toBeLessThanOrEqual(60);
    expect(pageMeta.description.length).toBeLessThanOrEqual(155);
    expect(pageMeta.description.length).toBeGreaterThan(80);
  });

  it("est déclarée dans le sitemap", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain(`https://sujeedesign.com${routes.testContraste}`);
  });
});
