import { describe, expect, it } from "vitest";
import {
  buildInkMask,
  detectBackground,
  detectIcon,
  downsample,
  inkBounds,
  reportIcon,
  type Pixels,
} from "@/lib/logo-icon";

type Rgb = [number, number, number];

function canvas(width: number, height: number, background: Rgb | null): { px: Pixels; fill: (x: number, y: number, w: number, h: number, color: Rgb) => void } {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = background?.[0] ?? 0;
    data[i + 1] = background?.[1] ?? 0;
    data[i + 2] = background?.[2] ?? 0;
    data[i + 3] = background ? 255 : 0;
  }
  return {
    px: { data, width, height },
    fill(x, y, w, h, color) {
      for (let py = y; py < y + h; py += 1) {
        for (let px2 = x; px2 < x + w; px2 += 1) {
          if (px2 < 0 || py < 0 || px2 >= width || py >= height) continue;
          const i = (py * width + px2) * 4;
          data[i] = color[0];
          data[i + 1] = color[1];
          data[i + 2] = color[2];
          data[i + 3] = 255;
        }
      }
    },
  };
}

describe("detectBackground", () => {
  it("reconnaît un fond uni", () => {
    const { px } = canvas(80, 60, [255, 255, 255]);
    expect(detectBackground(px)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("ne devine pas un fond sur une image transparente", () => {
    const { px } = canvas(80, 60, null);
    expect(detectBackground(px)).toBeNull();
  });
});

describe("detectIcon", () => {
  it("isole le symbole d'un lockup horizontal", () => {
    const { px, fill } = canvas(400, 120, [255, 255, 255]);
    fill(20, 20, 80, 80, [10, 10, 11]);
    for (let i = 0; i < 5; i += 1) fill(140 + i * 30, 40, 14, 46, [10, 10, 11]);

    const result = detectIcon(px);
    expect(result.mode).toBe("symbol");
    expect(result.region.w).toBe(result.region.h);
    // Le cadre contient le symbole complet…
    expect(result.region.x).toBeLessThanOrEqual(20);
    expect(result.region.y).toBeLessThanOrEqual(20);
    expect(result.region.x + result.region.w).toBeGreaterThanOrEqual(100);
    expect(result.region.y + result.region.h).toBeGreaterThanOrEqual(100);
    // …et s'arrête avant le texte.
    expect(result.region.x + result.region.w).toBeLessThan(140);
  });

  it("isole un symbole placé entre deux blocs de texte", () => {
    const { px, fill } = canvas(420, 120, [255, 255, 255]);
    for (let i = 0; i < 5; i += 1) fill(20 + i * 30, 46, 16, 38, [10, 10, 11]);
    fill(200, 16, 24, 88, [10, 10, 11]);
    for (let i = 0; i < 5; i += 1) fill(280 + i * 30, 46, 16, 38, [10, 10, 11]);

    const result = detectIcon(px);
    expect(result.mode).toBe("symbol");
    expect(result.confidence).toBe("high");
    // Le cadre est centré sur le symbole et ignore les deux blocs de texte.
    expect(result.region.x).toBeGreaterThan(150);
    expect(result.region.x + result.region.w).toBeLessThan(280);
    // Le cadre garde la forme du symbole (24 x 88 + marge) : pas de carré qui irait chercher les lettres.
    expect(result.region.w).toBeGreaterThanOrEqual(24);
    expect(result.region.w).toBeLessThan(60);
    expect(result.region.h).toBeGreaterThan(result.region.w);
  });

  it("garde un fichier déjà carré tel quel", () => {
    const { px, fill } = canvas(120, 120, null);
    fill(30, 30, 60, 60, [200, 50, 20]);

    const result = detectIcon(px);
    expect(result.mode).toBe("whole");
    expect(result.confidence).toBe("high");
    expect(result.ink).toEqual({ x: 30, y: 30, w: 60, h: 60 });
    // Cadre carré serré sur le dessin, marges rognées.
    expect(result.region.w).toBe(result.region.h);
    expect(result.region.w).toBe(68);
  });

  it("rogne les marges d'un logo transparent", () => {
    const { px, fill } = canvas(300, 200, null);
    fill(100, 50, 100, 100, [0, 0, 0]);

    const result = detectIcon(px);
    expect(result.ink).toEqual({ x: 100, y: 50, w: 100, h: 100 });
    expect(result.region.w).toBeGreaterThan(100);
    expect(result.region.w).toBeLessThanOrEqual(200);
    expect(result.region.w).toBe(result.region.h);
  });

  it("détoure un fond opaque avant de rogner", () => {
    const { px, fill } = canvas(200, 200, [255, 255, 255]);
    fill(80, 80, 40, 40, [0, 0, 0]);
    const background = detectBackground(px);
    const mask = buildInkMask(px, background);
    expect(inkBounds(mask, 200, 200)).toEqual({ x: 80, y: 80, w: 40, h: 40 });
  });
});

describe("reportIcon", () => {
  it("valide une icône pleine et centrée", () => {
    const { px, fill } = canvas(512, 512, null);
    // Disque plein centré, 200 px de diamètre.
    for (let y = 0; y < 512; y += 1) {
      for (let x = 0; x < 512; x += 1) {
        if (Math.hypot(x - 256, y - 256) <= 100) fill(x, y, 1, 1, [20, 20, 20]);
      }
    }
    const report = reportIcon(px);
    expect(report.needsRedesign).toBe(false);
    expect(report.metrics.find((metric) => metric.id === "lisibilite")?.state).not.toBe("ko");
    expect(report.metrics.find((metric) => metric.id === "zone-maskable")?.state).toBe("ok");
  });

  it("signale une icône aux traits trop fins", () => {
    const { px, fill } = canvas(512, 512, null);
    fill(254, 20, 2, 472, [0, 0, 0]);
    fill(20, 254, 472, 2, [0, 0, 0]);
    const report = reportIcon(px);
    expect(report.counts.ko).toBeGreaterThan(0);
    expect(report.needsRedesign).toBe(true);
    expect(report.verdict).toContain("refonte");
  });

  it("signale un dessin hors de la zone de sécurité", () => {
    const { px, fill } = canvas(512, 512, null);
    fill(0, 0, 512, 40, [0, 0, 0]);
    fill(0, 472, 512, 40, [0, 0, 0]);
    const report = reportIcon(px);
    expect(report.metrics.find((metric) => metric.id === "zone-maskable")?.state).toBe("ko");
  });
});

describe("downsample", () => {
  it("moyenne les blocs en tenant compte de l'alpha", () => {
    const px: Pixels = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    };
    const small = downsample(px, 1, 1);
    expect(small.width).toBe(1);
    expect(small.data[0]).toBe(255);
    expect(small.data[3]).toBe(64);
  });
});
