/**
 * Génération d'un PDF d'analyse, sans dépendance externe.
 *
 * Le PDF est écrit à la main : polices standard Helvetica (aucun fichier à
 * embarquer), texte en WinAnsiEncoding pour garder les accents, et vignettes
 * JPEG en XObject. Tout se passe dans le navigateur, le logo n'est jamais
 * envoyé. Le résultat s'ouvre dans n'importe quel lecteur et s'imprime en A4.
 */

export type PdfState = "ok" | "watch" | "ko";

export type PdfSupportRow = {
  label: string;
  context: string;
  state: PdfState;
  note: string;
};

export type PdfMetricRow = {
  label: string;
  value: string;
  state: PdfState;
  detail: string;
};

export type PdfImage = {
  label: string;
  jpeg: Uint8Array;
  width: number;
  height: number;
  /** Taille d'affichage en points. */
  draw: number;
};

export type ReportDoc = {
  fileName: string;
  siteName: string;
  date: string;
  score: { value: number; grade: string; label: string };
  verdict: string;
  supports: PdfSupportRow[];
  metrics: PdfMetricRow[];
  icons: PdfImage[];
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 46;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = 62;

type Rgb = [number, number, number];

const INK: Rgb = [0.04, 0.04, 0.043];
const MUTED: Rgb = [0.42, 0.42, 0.45];
const LINE: Rgb = [0.84, 0.84, 0.83];
const PAPER: Rgb = [0.973, 0.973, 0.961];
const WHITE: Rgb = [1, 1, 1];
const STATE_COLOR: Record<PdfState, Rgb> = {
  ok: [0.11, 0.42, 0.29],
  watch: [0.6, 0.42, 0.08],
  ko: [0.66, 0.14, 0.11],
};
const STATE_LABEL: Record<PdfState, string> = {
  ok: "Passe",
  watch: "À surveiller",
  ko: "Échec",
};

/** Caractères typographiques traduits en WinAnsi. */
const WIN_ANSI: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "‹": 0x8b,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "™": 0x99,
  "›": 0x9b,
  "œ": 0x9c,
  "Œ": 0x8c,
  "−": 0x2d,
  "·": 0xb7,
  "×": 0xd7,
};

function esc(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 63;
    if (char === "\\") out += "\\\\";
    else if (char === "(") out += "\\(";
    else if (char === ")") out += "\\)";
    else if (code === 10) out += " ";
    else if (code >= 32 && code <= 126) out += char;
    else {
      const mapped = WIN_ANSI[char] ?? code;
      if (mapped >= 32 && mapped <= 255) out += String.fromCharCode(mapped);
      else out += "?";
    }
  }
  return out;
}

const NARROW = "ijltfrI.,;:!'|[]()/";
const WIDE = "MWmw@%&";

/** Largeur approximative d'un texte en points, suffisante pour couper les lignes. */
export function textWidth(text: string, size: number): number {
  let units = 0;
  for (const char of text) {
    let factor = 0.52;
    if (char === " ") factor = 0.28;
    else if (NARROW.includes(char)) factor = 0.3;
    else if (WIDE.includes(char)) factor = 0.87;
    else if (char >= "A" && char <= "Z") factor = 0.66;
    else if (char >= "0" && char <= "9") factor = 0.556;
    units += factor;
  }
  return units * size;
}

/** Coupe un paragraphe en lignes qui tiennent dans une largeur donnée. */
export function wrapText(text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function buildImageObject(image: PdfImage): string {
  const bytes = image.jpeg;
  const header = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`;
  let body = "";
  const step = 4096;
  for (let i = 0; i < bytes.length; i += step) {
    body += String.fromCharCode(...bytes.subarray(i, Math.min(i + step, bytes.length)));
  }
  return `${header}${body}\nendstream`;
}

export function buildReportPdf(doc: ReportDoc): Uint8Array {
  const objects: (string | null)[] = [];
  const add = (body: string | null) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = add(null);
  const pagesId = add(null);
  const fontId = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  const boldId = add(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  const imageIds = doc.icons.map((image) => add(buildImageObject(image)));

  const contents: string[] = [];
  let ops: string[] = [];
  let y = 0;

  const color = (rgb: Rgb, stroke = false) =>
    `${rgb[0].toFixed(3)} ${rgb[1].toFixed(3)} ${rgb[2].toFixed(3)} ${stroke ? "RG" : "rg"}`;

  const text = (x: number, baseline: number, size: number, value: string, bold = false) => {
    ops.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${color(INK)} 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${esc(value)}) Tj ET`,
    );
  };

  const textColor = (
    x: number,
    baseline: number,
    size: number,
    value: string,
    rgb: Rgb,
    bold = false,
  ) => {
    ops.push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${color(rgb)} 1 0 0 1 ${x.toFixed(2)} ${baseline.toFixed(2)} Tm (${esc(value)}) Tj ET`,
    );
  };

  const rect = (x: number, rectY: number, w: number, h: number, rgb: Rgb) => {
    ops.push(`q ${color(rgb)} ${x.toFixed(2)} ${rectY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f Q`);
  };

  const rule = (fromX: number, toX: number, atY: number) => {
    ops.push(
      `q ${color(LINE, true)} 0.6 w ${fromX.toFixed(2)} ${atY.toFixed(2)} m ${toX.toFixed(2)} ${atY.toFixed(2)} l S Q`,
    );
  };

  const paragraph = (value: string, size = 10, lineHeight = 14.5, rgb: Rgb = INK) => {
    const lines = wrapText(value, size, CONTENT_W);
    for (const line of lines) {
      if (y - lineHeight < BOTTOM) {
        flush();
        beginPage();
      }
      y -= lineHeight;
      textColor(MARGIN, y, size, line, rgb);
    }
  };

  const footer = () => {
    rule(MARGIN, PAGE_W - MARGIN, 58);
    textColor(MARGIN, 44, 8, "Test réalisé dans votre navigateur, aucun fichier envoyé.", MUTED);
    const page = "Page __PAGE__";
    textColor(PAGE_W - MARGIN - textWidth(page, 8), 44, 8, page, MUTED);
  };

  const beginPage = (first = false) => {
    ops = [];
    if (first) {
      rect(0, PAGE_H - 128, PAGE_W, 128, INK);
      textColor(MARGIN, PAGE_H - 40, 8, "SUJEE DESIGN", [0.72, 0.72, 0.7], true);
      textColor(MARGIN, PAGE_H - 52, 8, "RAPPORT DE TEST DE LOGO", [0.72, 0.72, 0.7], true);
      y = PAGE_H - 128;
    } else {
      textColor(MARGIN, PAGE_H - 52, 8.5, `Rapport de test de logo · ${doc.siteName}`, MUTED, true);
      rule(MARGIN, PAGE_W - MARGIN, PAGE_H - 62);
      y = PAGE_H - 84;
    }
    footer();
  };

  const flush = () => {
    contents.push(ops.join("\n"));
  };

  const ensure = (height: number) => {
    if (y - height < BOTTOM) {
      flush();
      beginPage();
    }
  };

  const sectionTitle = (label: string) => {
    ensure(52);
    y -= 24;
    text(MARGIN, y, 8, label.toUpperCase(), true);
    y -= 8;
    rule(MARGIN, PAGE_W - MARGIN, y);
    y -= 14;
  };

  // Page de garde
  beginPage(true);
  const headerTitle = doc.siteName.trim() || "Votre site";
  textColor(MARGIN, PAGE_H - 92, 26, headerTitle.slice(0, 34), WHITE, true);
  const meta = `${doc.fileName} · ${doc.date}`;
  textColor(MARGIN, PAGE_H - 112, 9, meta.slice(0, 96), [0.68, 0.68, 0.66]);

  // Score
  y -= 26;
  const scoreTop = y;
  textColor(MARGIN, scoreTop - 44, 46, String(doc.score.value), INK, true);
  const scoreWidth = textWidth(String(doc.score.value), 46);
  textColor(MARGIN + scoreWidth + 4, scoreTop - 44, 12, "/100", MUTED);
  const badgeX = MARGIN + scoreWidth + 46;
  rect(badgeX, scoreTop - 46, 38, 38, INK);
  textColor(badgeX + 13, scoreTop - 33, 19, doc.score.grade, WHITE, true);
  textColor(badgeX + 52, scoreTop - 18, 12.5, doc.score.label, INK, true);
  textColor(badgeX + 52, scoreTop - 33, 9, "Note globale du logo sur les six supports", MUTED);
  y = scoreTop - 58;

  rule(MARGIN, PAGE_W - MARGIN, y);
  y -= 6;
  paragraph(doc.verdict, 10.5, 15.5);

  // Aperçus
  sectionTitle("L'icône réduite");
  // Les vignettes sont alignées sur une même ligne de base, sinon les légendes
  // flottent et la comparaison des tailles ne veut plus rien dire.
  const maxBox = doc.icons.reduce((max, image) => Math.max(max, image.draw), 0);
  const count = Math.max(1, doc.icons.length);
  const gap = 12;
  // La grille doit tenir dans la largeur imprimable, sinon la dernière vignette
  // sort de la marge.
  const cell = Math.min(maxBox + 22, (CONTENT_W - gap * (count - 1)) / count);
  const cellY = y - cell - 6;
  ensure(cell + 34);
  for (let index = 0; index < doc.icons.length; index += 1) {
    const image = doc.icons[index];
    if (!image) continue;
    const box = image.draw;
    const cellX = MARGIN + index * (cell + gap);
    ops.push(`q ${color(PAPER)} ${cellX.toFixed(2)} ${cellY.toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re f Q`);
    ops.push(`q ${color(LINE, true)} 0.6 w ${cellX.toFixed(2)} ${cellY.toFixed(2)} ${cell.toFixed(2)} ${cell.toFixed(2)} re S Q`);
    ops.push(
      `q ${box.toFixed(2)} 0 0 ${box.toFixed(2)} ${(cellX + (cell - box) / 2).toFixed(2)} ${(cellY + (cell - box) / 2).toFixed(2)} cm /Im${imageIds[index]} Do Q`,
    );
    textColor(cellX + (cell - textWidth(image.label, 8)) / 2, cellY - 14, 8, image.label, MUTED);
  }
  y = cellY - 32;

  // Supports en échec, mis en avant
  const failed = doc.supports.filter((support) => support.state !== "ok");
  if (failed.length > 0) {
    sectionTitle("Ce qui ne passe pas partout");
    for (const support of failed) {
      ensure(42);
      y -= 6;
      const rgb = STATE_COLOR[support.state];
      rect(MARGIN, y - 3, 7, 7, rgb);
      text(MARGIN + 14, y, 10.5, `${support.label} · ${support.context}`, true);
      const label = STATE_LABEL[support.state];
      textColor(PAGE_W - MARGIN - textWidth(label, 9.5), y, 9.5, label, rgb, true);
      y -= 12;
      for (const line of wrapText(support.note, 9, CONTENT_W - 14)) {
        textColor(MARGIN + 14, y, 9, line, MUTED);
        y -= 11.5;
      }
      y -= 5;
    }
  }

  // Mesures
  if (doc.metrics.length > 0) {
    sectionTitle("Les mesures sur l'icône");
    for (const metric of doc.metrics) {
      ensure(38);
      y -= 4;
      text(MARGIN, y, 9.8, metric.label, true);
      const value = metric.value.slice(0, 40);
      textColor(PAGE_W - MARGIN - textWidth(value, 9), y, 9, value, STATE_COLOR[metric.state], true);
      y -= 11;
      for (const line of wrapText(metric.detail, 8.8, CONTENT_W)) {
        textColor(MARGIN, y, 8.8, line, MUTED);
        y -= 10.6;
      }
      y -= 4;
    }
  }

  // Tableau complet des supports, gardé d'un seul bloc : une ligne orpheline
  // en haut de page ne sert à rien.
  if (y - 300 < BOTTOM) {
    flush();
    beginPage();
  }
  sectionTitle("Support par support");
  for (const support of doc.supports) {
    ensure(40);
    y -= 4;
    text(MARGIN, y, 10, support.label, true);
    const label = STATE_LABEL[support.state];
    textColor(PAGE_W - MARGIN - textWidth(label, 9), y, 9, label, STATE_COLOR[support.state], true);
    textColor(PAGE_W - MARGIN - textWidth(label, 9) - 6 - textWidth(support.context, 9), y, 9, support.context, MUTED);
    y -= 11;
    for (const line of wrapText(support.note, 8.8, CONTENT_W)) {
      textColor(MARGIN, y, 8.8, line, MUTED);
      y -= 10.6;
    }
    y -= 4;
    rule(MARGIN, PAGE_W - MARGIN, y + 4);
  }

  // Conclusion
  sectionTitle("La suite");
  paragraph(
    "Une icône de marque doit tenir à 16 px : si le symbole se réduit en tache, il faut simplifier le trait, augmenter les pleins ou rapprocher les éléments plutôt que d'accepter un favicon illisible. Le pack favicon proposé sur la page reprend le cadre choisi, plaque comprise.",
    9.5,
    14,
  );
  y -= 16;
  textColor(MARGIN, y, 9, "sujeedesign.com/ressources/tester-son-logo", MUTED, true);
  flush();

  // Assemblage
  const pageIds: number[] = [];
  contents.forEach((content, index) => {
    const stream = content.replace(/__PAGE__/g, String(index + 1));
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const pageId = add(null);
    pageIds.push(pageId);
    objects[pageId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> /XObject << ${imageIds
      .map((id, i) => `/Im${id} ${id} 0 R`)
      .join(" ")} >> >> /Contents ${contentId} 0 R >>`;
  });

  objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  let pdf = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i] ?? ""}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return bytes;
}
