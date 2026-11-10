export type ZipEntry = { name: string; data: Uint8Array };
export type IcoImage = { size: number; png: Uint8Array };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    crc = (CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const encoder = new TextEncoder();

/**
 * Archive ZIP minimale (méthode « store », sans compression) : suffisant pour
 * les quelques PNG d'un pack favicon et lisible par tous les systèmes.
 */
export function buildZip(entries: ZipEntry[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  // Date DOS fixe : 2026-01-01, pour un pack reproductible.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(entry.data.length),
      u32(entry.data.length),
      u16(name.length),
      u16(0),
      name,
      entry.data,
    ]);
    central.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0x0800),
        u16(0),
        u16(dosTime),
        u16(dosDate),
        u32(crc),
        u32(entry.data.length),
        u32(entry.data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    chunks.push(local);
    offset += local.length;
  }

  const directory = concat(central);
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(directory.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...chunks, directory, end]);
}

/**
 * ICO multi-tailles contenant des PNG (supporté depuis Windows Vista et par
 * tous les navigateurs modernes).
 */
export function buildIco(images: IcoImage[]): Uint8Array {
  const count = images.length;
  const header = concat([u16(0), u16(1), u16(count)]);
  let offset = 6 + count * 16;
  const entries: Uint8Array[] = [];
  const payload: Uint8Array[] = [];
  for (const image of images) {
    const dimension = image.size >= 256 ? 0 : image.size;
    entries.push(
      concat([
        new Uint8Array([dimension, dimension, 0, 0]),
        u16(1),
        u16(32),
        u32(image.png.length),
        u32(offset),
      ]),
    );
    payload.push(image.png);
    offset += image.png.length;
  }
  return concat([header, ...entries, ...payload]);
}

export function buildManifest(name: string, themeColor: string): string {
  return `${JSON.stringify(
    {
      name,
      short_name: name.length > 12 ? `${name.slice(0, 12).trim()}…` : name,
      start_url: "/",
      display: "standalone",
      background_color: "#F7F7F5",
      theme_color: themeColor,
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    null,
    2,
  )}\n`;
}
