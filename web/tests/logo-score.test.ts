import { describe, expect, it } from "vitest";
import { reportIcon, scoreIcon, supportVerdicts, type Pixels } from "../lib/logo-icon";

function blank(size = 256): Pixels {
  return { data: new Uint8ClampedArray(size * size * 4), width: size, height: size };
}

/** Disque plein centré, comme un symbole compact. */
function disc(radiusRatio: number, size = 256, tone = 128): Pixels {
  const px = blank(size);
  const c = size / 2;
  const r = size * radiusRatio;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const inside = (x - c) ** 2 + (y - c) ** 2 <= r * r;
      const i = (y * size + x) * 4;
      px.data[i] = tone;
      px.data[i + 1] = tone;
      px.data[i + 2] = tone;
      px.data[i + 3] = inside ? 255 : 0;
    }
  }
  return px;
}

describe("supportVerdicts", () => {
  it("teste les six supports réels", () => {
    const icon = disc(0.34);
    const report = reportIcon(icon);
    const supports = supportVerdicts(icon, report);
    expect(supports.map((s) => s.context)).toEqual([
      "16 px",
      "32 px",
      "48 px",
      "180 px",
      "192 px",
      "512 px",
    ]);
    expect(supports.every((s) => s.note.length > 0)).toBe(true);
  });

  it("passe un symbole compact et centré", () => {
    const icon = disc(0.34);
    const supports = supportVerdicts(icon, reportIcon(icon));
    expect(supports.find((s) => s.id === "onglet")?.state).toBe("ok");
  });

  it("échoue sur un détail minuscule, illisible à 16 px", () => {
    const icon = disc(0.05);
    const supports = supportVerdicts(icon, reportIcon(icon));
    expect(supports.find((s) => s.id === "onglet")?.state).toBe("ko");
  });
});

describe("scoreIcon", () => {
  it("note haut un logo qui passe partout", () => {
    const icon = disc(0.34);
    const report = reportIcon(icon);
    const score = scoreIcon(supportVerdicts(icon, report), report);
    expect(score.value).toBeGreaterThanOrEqual(85);
    expect(score.grade).toBe("A");
  });

  it("plafonne la note quand le verdict conclut à une refonte", () => {
    const icon = disc(0.05);
    const report = reportIcon(icon);
    const score = scoreIcon(supportVerdicts(icon, report), report);
    expect(report.needsRedesign).toBe(true);
    expect(score.value).toBeLessThanOrEqual(44);
    expect(score.label).toContain("Refonte");
  });
});
