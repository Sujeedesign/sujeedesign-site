import { describe, expect, it } from "vitest";
import { buildReportPdf, textWidth, wrapText, type ReportDoc } from "../lib/report-pdf";

const doc: ReportDoc = {
  fileName: "mohan-jewellery.png",
  siteName: "Mohan Jewellery",
  date: "10 novembre 2026",
  score: { value: 56, grade: "C", label: "Fragile selon les supports" },
  verdict:
    "L'icône est lisible en grand mais le trait fin disparaît à 16 px. Réduire les détails et épaissir les pleins avant de déployer ce favicon.",
  supports: [
    { label: "Onglet du navigateur", context: "16 px", state: "ko", note: "Échec : 3 % d'encre, 9 taches." },
    { label: "Barre de favoris", context: "32 px", state: "watch", note: "Fragile : 5 % d'encre, 7 taches." },
    { label: "Store et fichier source", context: "512 px", state: "ok", note: "Passe : 12 % d'encre, 2 taches." },
  ],
  metrics: [
    { label: "Contraste sur onglet clair", value: "1,8:1", state: "ko", detail: "Le blanc sur blanc ne se voit pas." },
  ],
  icons: [
    {
      label: "16 px",
      jpeg: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      width: 32,
      height: 32,
      draw: 16,
    },
  ],
};

function latin1(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return out;
}

describe("buildReportPdf", () => {
  it("produit un PDF 1.4 refermé", () => {
    const pdf = buildReportPdf(doc);
    const raw = latin1(pdf);
    expect(raw.startsWith("%PDF-1.4")).toBe(true);
    expect(raw.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(raw).toContain("/Type /Catalog");
    expect(raw).toContain("/Type /Pages");
    expect(raw).toContain("startxref");
  });

  it("écrit les accents en WinAnsi", () => {
    const raw = latin1(buildReportPdf(doc));
    expect(raw).toContain("Mohan Jewellery");
    expect(raw).toContain("Fragile selon les supports");
    // accents écrits directement en WinAnsi (0xC9 pour « É »)
    expect(raw).toContain("\u00c9chec");
    expect(raw.charCodeAt(raw.indexOf("chec") - 1)).toBe(0xc9);
  });

  it("pagine et numérote les pages", () => {
    const raw = latin1(buildReportPdf(doc));
    expect(raw).toContain("Page 1");
    expect(raw).not.toContain("__PAGE__");
  });

  it("déclare une table xref cohérente", () => {
    const raw = latin1(buildReportPdf(doc));
    const startxref = Number(raw.slice(raw.lastIndexOf("startxref") + 10).split("\n")[0]);
    expect(raw.slice(startxref, startxref + 4)).toBe("xref");
    const declared = Number(raw.slice(startxref).split("\n")[1]?.split(" ")[1]);
    expect(declared).toBeGreaterThan(5);
    const entries = raw
      .slice(startxref)
      .split("\n")
      .slice(2)
      .filter((line) => /\bn\s*$/.test(line));
    expect(entries).toHaveLength(declared - 1);
    entries.forEach((line, index) => {
      const offset = Number(line.slice(0, 10));
      expect(raw.slice(offset)).toMatch(new RegExp(`^${index + 1} 0 obj`));
    });
  });
});

describe("wrapText", () => {
  it("coupe au mot et respecte la largeur", () => {
    const lines = wrapText("Le trait fin disparaît complètement à seize pixels de haut", 10, 120);
    expect(lines.length).toBeGreaterThan(2);
    for (const line of lines) expect(textWidth(line, 10)).toBeLessThanOrEqual(120);
  });

  it("garde les longs mots entiers", () => {
    expect(wrapText("anticonstitutionnellement", 10, 20)).toEqual(["anticonstitutionnellement"]);
  });
});
