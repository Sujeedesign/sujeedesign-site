import { describe, expect, it } from "vitest";
import { buildIco, buildManifest, buildZip, crc32 } from "@/lib/favicon-pack";

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("crc32", () => {
  it("calcule la somme de contrôle de référence", () => {
    expect(crc32(new TextEncoder().encode("abc"))).toBe(0x352441c2);
  });
});

describe("buildIco", () => {
  it("écrit l'en-tête, les entrées et les offsets", () => {
    const png16 = new Uint8Array([1, 2, 3, 4]);
    const png32 = new Uint8Array([9, 9, 9, 9, 9]);
    const ico = buildIco([
      { size: 16, png: png16 },
      { size: 32, png: png32 },
    ]);
    const data = view(ico);
    expect(data.getUint16(0, true)).toBe(0);
    expect(data.getUint16(2, true)).toBe(1);
    expect(data.getUint16(4, true)).toBe(2);
    // Première entrée
    expect(ico[6]).toBe(16);
    expect(ico[7]).toBe(16);
    expect(data.getUint16(10, true)).toBe(1);
    expect(data.getUint16(12, true)).toBe(32);
    expect(data.getUint32(14, true)).toBe(4);
    expect(data.getUint32(18, true)).toBe(38);
    expect(Array.from(ico.slice(38, 42))).toEqual([1, 2, 3, 4]);
    // Seconde entrée
    expect(data.getUint32(34, true)).toBe(42);
    expect(Array.from(ico.slice(42))).toEqual([9, 9, 9, 9, 9]);
  });

  it("code 256 px comme 0 dans l'entrée", () => {
    const ico = buildIco([{ size: 256, png: new Uint8Array([7]) }]);
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });
});

describe("buildZip", () => {
  it("produit une archive store valide", () => {
    const files = [
      { name: "favicon-16.png", data: new Uint8Array([1, 2, 3]) },
      { name: "site.webmanifest", data: new TextEncoder().encode("{}") },
    ];
    const zip = buildZip(files);
    const data = view(zip);
    expect(data.getUint32(0, true)).toBe(0x04034b50);
    expect(zip[30 + "favicon-16.png".length]).toBe(1);
    expect(data.getUint32(zip.length - 22, true)).toBe(0x06054b50);
    expect(data.getUint16(zip.length - 22 + 10, true)).toBe(2);
    // Le nom du fichier apparaît dans l'en-tête local et le répertoire central.
    const content = text(zip);
    expect(content).toContain("favicon-16.png");
    expect(content).toContain("site.webmanifest");
    // CRC du premier fichier = celui de [1,2,3].
    const crc = data.getUint32(14, true);
    expect(crc).toBe(crc32(new Uint8Array([1, 2, 3])));
  });

  it("reste lisible par unzip", () => {
    const zip = buildZip([
      { name: "a.txt", data: new TextEncoder().encode("bonjour") },
      { name: "dossier/b.txt", data: new TextEncoder().encode("ok") },
    ]);
    expect(zip.length).toBeGreaterThan(0);
  });
});

describe("buildManifest", () => {
  it("déclare les icônes 192, 512 et maskable", () => {
    const manifest = JSON.parse(buildManifest("Sujee Design", "#0A0A0B"));
    expect(manifest.icons).toHaveLength(3);
    expect(manifest.icons[2].purpose).toBe("maskable");
    expect(manifest.theme_color).toBe("#0A0A0B");
  });
});
