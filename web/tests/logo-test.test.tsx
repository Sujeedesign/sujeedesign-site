import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { TesterLogo, faqItems, pageMeta } from "@/components/pages/TesterLogo";
import { RessourcesHub } from "@/components/pages/RessourcesHub";
import sitemap from "@/app/sitemap";
import { routes } from "@/lib/routes";
import { analyseLogo, contrastRatio, relativeLuminance, type Pixels } from "@/lib/logo-test";

function makePixels(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number],
): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = a;
    }
  }
  return { data, width, height };
}

const BLACK_OPAQUE = makePixels(32, 32, () => [10, 10, 11, 255]);

describe("mesures de base", () => {
  it("calcule la luminance et le contraste WCAG", () => {
    const white = relativeLuminance(255, 255, 255);
    const black = relativeLuminance(0, 0, 0);
    expect(white).toBeCloseTo(1, 5);
    expect(black).toBeCloseTo(0, 5);
    expect(contrastRatio(white, black)).toBeCloseTo(21, 1);
    expect(contrastRatio(black, white)).toBeCloseTo(contrastRatio(white, black), 5);
  });
});

describe("analyse d'un logo", () => {
  it("valide un logo encre, opaque et assez grand", () => {
    const result = analyseLogo(BLACK_OPAQUE, 1200, false);
    const byId = Object.fromEntries(result.metrics.map((metric) => [metric.id, metric]));
    expect(byId.resolution?.state).toBe("ok");
    expect(byId.transparence?.state).toBe("watch");
    expect(byId["contraste-clair"]?.state).toBe("ok");
    expect(byId["contraste-sombre"]?.state).toBe("ko");
    expect(result.counts.ko).toBe(1);
    expect(result.verdict).toContain("bloquant");
  });

  it("signale un fichier trop petit", () => {
    const result = analyseLogo(BLACK_OPAQUE, 180, false);
    const resolution = result.metrics.find((metric) => metric.id === "resolution");
    expect(resolution?.state).toBe("ko");
    expect(resolution?.value).toContain("180 px");
  });

  it("laisse passer un vectoriel quelle que soit sa taille de rendu", () => {
    const result = analyseLogo(BLACK_OPAQUE, 64, true);
    const resolution = result.metrics.find((metric) => metric.id === "resolution");
    expect(resolution?.state).toBe("ok");
    expect(resolution?.value).toBe("vectoriel");
  });

  it("détecte la transparence quand des pixels sont partiels", () => {
    const pixels = makePixels(32, 32, (x) => (x < 16 ? [10, 10, 11, 255] : [0, 0, 0, 0]));
    const result = analyseLogo(pixels, 800, false);
    expect(result.metrics.find((metric) => metric.id === "transparence")?.state).toBe("ok");
  });

  it("bloque un logo clair sur fond clair", () => {
    const pixels = makePixels(32, 32, () => [240, 240, 236, 255]);
    const result = analyseLogo(pixels, 800, false);
    expect(result.metrics.find((metric) => metric.id === "contraste-clair")?.state).toBe("ko");
  });

  it("bloque un logo qui repose sur des écarts de couleur", () => {
    const pixels = makePixels(32, 32, (x) => (x < 16 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const result = analyseLogo(pixels, 800, false);
    const unTon = result.metrics.find((metric) => metric.id === "un-ton");
    expect(unTon?.state).toBe("ko");
    expect(unTon?.value).toContain("%");
  });

  it("valide un logo qui tient en un ton", () => {
    const pixels = makePixels(32, 32, (x) => (x < 16 ? [20, 20, 22, 255] : [0, 0, 0, 0]));
    const result = analyseLogo(pixels, 800, false);
    expect(result.metrics.find((metric) => metric.id === "un-ton")?.state).toBe("ok");
  });
});

describe("page de test", () => {
  it("rend un seul h1, l'outil et la FAQ", () => {
    const { container } = render(<TesterLogo />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("details")).toHaveLength(faqItems.length);
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
    expect(container).toHaveTextContent("Glissez votre logo ici");
  });

  it("ne promet pas d'envoyer le fichier", () => {
    const { container } = render(<TesterLogo />);
    expect(container.textContent).toContain("n'est ni envoyé");
  });

  it("garde un titre et une description dans les limites SEO", () => {
    expect(pageMeta.title.length).toBeLessThanOrEqual(60);
    expect(pageMeta.description.length).toBeLessThanOrEqual(155);
  });
});

describe("maillage des ressources", () => {
  it("le hub liste les quatre pages", () => {
    const { container } = render(<RessourcesHub />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(routes.calculateurBudgetIdentite);
    expect(hrefs).toContain(routes.guidePrixLogo);
    expect(hrefs).toContain(routes.generateurBriefIdentite);
    expect(hrefs).toContain(routes.testerSonLogo);
  });

  it("le sitemap contient le test de logo", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain(`https://sujeedesign.com${routes.testerSonLogo}`);
  });
});
