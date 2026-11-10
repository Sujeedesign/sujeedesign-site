export type Pixels = {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type IconDetection = {
  /** Cadre carré à découper dans l'image source. */
  region: Rect;
  /** Boîte réellement occupée par l'encre. */
  ink: Rect;
  mode: "symbol" | "whole";
  confidence: "high" | "medium" | "low";
  message: string;
};

export type IconMetricState = "ok" | "watch" | "ko";

export type IconMetric = {
  id: string;
  label: string;
  state: IconMetricState;
  value: string;
  detail: string;
};

export type IconReport = {
  metrics: IconMetric[];
  verdict: string;
  counts: Record<IconMetricState, number>;
  needsRedesign: boolean;
};

const ALPHA_FLOOR = 16;
const BG_TOLERANCE = 26;
const CORNER_TOLERANCE = 14;

type Rgb = { r: number; g: number; b: number };

function pixel(px: Pixels, x: number, y: number): [number, number, number, number] {
  const i = (y * px.width + x) * 4;
  return [px.data[i] ?? 0, px.data[i + 1] ?? 0, px.data[i + 2] ?? 0, px.data[i + 3] ?? 0];
}

/**
 * Cherche un fond uni en échantillonnant les quatre coins.
 * Retourne null dès que le fond n'est pas homogène (photo, dégradé, dessin pleine page).
 */
export function detectBackground(px: Pixels): Rgb | null {
  const { width, height } = px;
  if (width < 4 || height < 4) return null;

  const spots: Array<[number, number]> = [
    [1, 1],
    [width - 2, 1],
    [1, height - 2],
    [width - 2, height - 2],
  ];

  const samples: Rgb[] = [];
  for (const [sx, sy] of spots) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const x = sx + dx;
        const y = sy + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const [pr, pg, pb, pa] = pixel(px, x, y);
        if (pa < 200) continue;
        r += pr;
        g += pg;
        b += pb;
        n += 1;
      }
    }
    if (n > 0) samples.push({ r: r / n, g: g / n, b: b / n });
  }

  if (samples.length < 3) return null;
  const first = samples[0]!;
  const spread = samples.reduce(
    (max, color) =>
      Math.max(max, Math.abs(color.r - first.r), Math.abs(color.g - first.g), Math.abs(color.b - first.b)),
    0,
  );
  if (spread > CORNER_TOLERANCE) return null;

  const mean = samples.reduce(
    (acc, color) => ({ r: acc.r + color.r / samples.length, g: acc.g + color.g / samples.length, b: acc.b + color.b / samples.length }),
    { r: 0, g: 0, b: 0 },
  );
  return mean;
}

/** Masque des pixels qui portent du dessin (hors fond uni et hors transparence). */
export function buildInkMask(px: Pixels, background: Rgb | null): Uint8Array {
  const mask = new Uint8Array(px.width * px.height);
  for (let i = 0, p = 0; i < px.data.length; i += 4, p += 1) {
    const alpha = px.data[i + 3] ?? 0;
    if (alpha < ALPHA_FLOOR) continue;
    if (!background) {
      mask[p] = 1;
      continue;
    }
    const diff = Math.max(
      Math.abs((px.data[i] ?? 0) - background.r),
      Math.abs((px.data[i + 1] ?? 0) - background.g),
      Math.abs((px.data[i + 2] ?? 0) - background.b),
    );
    if (diff > BG_TOLERANCE) mask[p] = 1;
  }
  return mask;
}

/** Boîte englobante de l'encre, ou null si la zone est vide. */
export function inkBounds(mask: Uint8Array, width: number, height: number): Rect | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if (!mask[row + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function boundsIn(mask: Uint8Array, width: number, x0: number, x1: number, y0: number, y1: number): Rect | null {
  let minX = x1;
  let minY = y1;
  let maxX = -1;
  let maxY = -1;
  for (let y = y0; y < y1; y += 1) {
    const row = y * width;
    for (let x = x0; x < x1; x += 1) {
      if (!mask[row + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : sorted[middle] ?? 0;
}

function countInk(mask: Uint8Array, width: number, rect: Rect): number {
  let total = 0;
  for (let y = rect.y; y < rect.y + rect.h; y += 1) {
    const row = y * width;
    for (let x = rect.x; x < rect.x + rect.w; x += 1) if (mask[row + x]) total += 1;
  }
  return total;
}

/** Groupes de colonnes séparés par un vide d'au moins `minGap` pixels. */
function columnGroups(mask: Uint8Array, width: number, area: Rect, minGap: number): Rect[] {
  const counts = new Int32Array(area.w);
  for (let y = area.y; y < area.y + area.h; y += 1) {
    const row = y * width;
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const i = x - area.x;
      if (mask[row + x]) counts[i] = (counts[i] ?? 0) + 1;
    }
  }
  return runsOf(counts, minGap).flatMap(([from, to]) => {
    const rect = boundsIn(mask, width, area.x + from, area.x + to, area.y, area.y + area.h);
    return rect ? [rect] : [];
  });
}

/** Groupes de lignes séparés par un vide d'au moins `minGap` pixels. */
function rowGroups(mask: Uint8Array, width: number, area: Rect, minGap: number): Rect[] {
  const counts = new Int32Array(area.h);
  for (let y = area.y; y < area.y + area.h; y += 1) {
    const row = y * width;
    for (let x = area.x; x < area.x + area.w; x += 1) {
      const i = y - area.y;
      if (mask[row + x]) counts[i] = (counts[i] ?? 0) + 1;
    }
  }
  return runsOf(counts, minGap).flatMap(([from, to]) => {
    const rect = boundsIn(mask, width, area.x, area.x + area.w, area.y + from, area.y + to);
    return rect ? [rect] : [];
  });
}

function runsOf(counts: Int32Array, minGap: number): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  let start = -1;
  let lastInk = -1;
  for (let i = 0; i < counts.length; i += 1) {
    if ((counts[i] ?? 0) > 0) {
      if (start < 0) start = i;
      lastInk = i;
    } else if (start >= 0 && i - lastInk > minGap) {
      runs.push([start, lastInk + 1]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, lastInk + 1]);
  return runs;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Cadre carré centré sur une zone, toujours contenu dans l'image. */
export function squareRegion(around: Rect, width: number, height: number, margin = 0.14): Rect {
  const side = Math.max(
    8,
    Math.min(Math.round(Math.max(around.w, around.h) * (1 + margin)), width, height),
  );
  const cx = around.x + around.w / 2;
  const cy = around.y + around.h / 2;
  return {
    x: Math.round(clamp(cx - side / 2, 0, width - side)),
    y: Math.round(clamp(cy - side / 2, 0, height - side)),
    w: side,
    h: side,
  };
}

/**
 * Cadre qui entoure une zone avec une marge, sans forcer un carré : les lettres
 * voisines restent dehors. L'export recentre ensuite le dessin dans le carré final.
 */
export function paddedBox(around: Rect, width: number, height: number, margin = 0.14): Rect {
  const pad = Math.round(Math.max(around.w, around.h) * margin * 0.5);
  const x0 = Math.max(0, around.x - pad);
  const y0 = Math.max(0, around.y - pad);
  const x1 = Math.min(width, around.x + around.w + pad);
  const y1 = Math.min(height, around.y + around.h + pad);
  return {
    x: Math.round(x0),
    y: Math.round(y0),
    w: Math.max(8, Math.round(x1 - x0)),
    h: Math.max(8, Math.round(y1 - y0)),
  };
}

/**
 * Isole l'icône d'un logo : détoure le fond uni, rogne les marges, puis sépare
 * le symbole du texte par profil de densité. Repli assumé sur le logo entier.
 */
export function detectIcon(px: Pixels, margin = 0.14): IconDetection {
  const { width, height } = px;
  const background = detectBackground(px);
  const mask = buildInkMask(px, background);
  const full = inkBounds(mask, width, height);

  if (!full) {
    return {
      region: { x: 0, y: 0, w: Math.min(width, height), h: Math.min(width, height) },
      ink: { x: 0, y: 0, w: width, h: height },
      mode: "whole",
      confidence: "low",
      message: "Aucun dessin détecté : le fichier semble vide ou entièrement transparent.",
    };
  }

  const whole = squareRegion(full, width, height, margin);
  const squareness = full.w / full.h;

  // 1. Symbole à côté du texte (lockup horizontal).
  const gap = Math.max(3, Math.round(full.w * 0.018));
  const columns = columnGroups(mask, width, full, gap);
  if (columns.length >= 2) {
    // a. Le symbole occupe la hauteur du fichier, le texte non : cas le plus net,
    // y compris quand le symbole est au centre d'un lockup (symbole entre deux mots).
    const tall = columns.filter((group) => group.h >= full.h * 0.7 && group.w <= full.w * 0.6);
    if (tall.length === 1 && tall[0]) {
      return {
        region: paddedBox(tall[0], width, height, margin),
        ink: full,
        mode: "symbol",
        confidence: "high",
        message:
          "Le symbole a été isolé : c'est le seul élément qui occupe toute la hauteur du logo. Vérifie le cadre, un ajustement manuel reste possible.",
      };
    }

    let best: { rect: Rect; score: number } | null = null;
    for (const group of columns) {
      const others = columns.filter((item) => item !== group).map((item) => item.w);
      const reference = median(others);
      if (reference === 0) continue;
      const ratio = group.w / reference;
      if (ratio < 1.45 || group.h < full.h * 0.5) continue;
      const aspect = group.w / group.h;
      const shapeScore = 1 / (1 + Math.abs(Math.log(clamp(aspect, 0.05, 20))));
      const density = countInk(mask, width, group) / (group.w * group.h);
      const score = ratio * (0.6 + shapeScore) * (0.5 + density);
      if (!best || score > best.score) best = { rect: group, score };
    }
    if (best) {
      return {
        region: paddedBox(best.rect, width, height, margin),
        ink: full,
        mode: "symbol",
        confidence: best.score >= 3 ? "high" : "medium",
        message:
          "Le symbole a été isolé du texte automatiquement. Le cadre entoure le symbole : vérifie qu'il ne coupe rien et qu'il ne reste pas de lettre.",
      };
    }
  }

  // 2. Symbole au-dessus ou en dessous du texte (lockup vertical).
  const rowGap = Math.max(3, Math.round(full.h * 0.05));
  const rows = rowGroups(mask, width, full, rowGap);
  if (rows.length >= 2) {
    let best: { rect: Rect; score: number } | null = null;
    for (const band of rows) {
      if (band.h < full.h * 0.18) continue;
      if (band.w >= full.w * 0.92) continue;
      const aspect = band.w / band.h;
      const score = 1 / (1 + Math.abs(Math.log(clamp(aspect, 0.05, 20))));
      const density = countInk(mask, width, band) / (band.w * band.h);
      const weighted = score * (0.5 + density);
      if (!best || weighted > best.score) best = { rect: band, score: weighted };
    }
    if (best && best.score > 0.18) {
      return {
        region: paddedBox(best.rect, width, height, margin),
        ink: full,
        mode: "symbol",
        confidence: "medium",
        message:
          "Le symbole a été isolé du bloc de texte. Vérifie le cadre : un ajustement manuel reste possible.",
      };
    }
  }

  // 3. Repli honnête : le fichier ressemble déjà à une icône, ou la découpe est indécidable.
  const alreadyIcon = squareness >= 0.8 && squareness <= 1.25;
  return {
    region: whole,
    ink: full,
    mode: "whole",
    confidence: alreadyIcon ? "high" : "low",
    message: alreadyIcon
      ? "Le fichier est déjà cadré comme une icône : le carré couvre le dessin entier, marges rognées."
      : "Impossible de séparer le symbole du texte avec certitude. Le cadre garde le logo entier : ajuste-le à la main pour ne garder que l'icône.",
  };
}

type RgbSample = { r: number; g: number; b: number };

function dominantInkColor(px: Pixels): RgbSample | null {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < px.data.length; i += 4) {
    const alpha = px.data[i + 3] ?? 0;
    if (alpha < 96) continue;
    const r = px.data[i] ?? 0;
    const g = px.data[i + 1] ?? 0;
    const b = px.data[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const entry = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    entry.r += r;
    entry.g += g;
    entry.b += b;
    entry.n += 1;
    buckets.set(key, entry);
  }
  let best: { r: number; g: number; b: number; n: number } | null = null;
  for (const entry of buckets.values()) if (!best || entry.n > best.n) best = entry;
  if (!best) return null;
  return { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n };
}

function luminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const LIGHT_BG = luminance(247, 247, 245);
const DARK_BG = luminance(10, 10, 11);

/** Compte les taches distinctes d'une grille binaire (4-connexité). */
export function countBlobs(mask: Uint8Array, width: number, height: number): number {
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  let blobs = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) continue;
    blobs += 1;
    stack.push(start);
    seen[start] = 1;
    while (stack.length > 0) {
      const index = stack.pop()!;
      const x = index % width;
      const y = (index - x) / width;
      const neighbours = [
        x > 0 ? index - 1 : -1,
        x < width - 1 ? index + 1 : -1,
        y > 0 ? index - width : -1,
        y < height - 1 ? index + width : -1,
      ];
      for (const next of neighbours) {
        if (next < 0 || seen[next] || !mask[next]) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
  }
  return blobs;
}

/**
 * Diagnostic de l'icône telle qu'elle sera vue en favicon : lisibilité à 16 px,
 * contraste sur onglet clair et sombre, tenue dans la zone de sécurité maskable.
 */
export function reportIcon(icon: Pixels): IconReport {
  const { width, height } = icon;
  const size = Math.min(width, height);
  const scale = size / 512;
  const at16 = Math.max(8, Math.round(16 * (size / 512)) || 16);

  // Rééchantillonnage 16 px pour juger de la finesse réelle.
  const small = downsample(icon, at16, at16);
  let ink = 0;
  for (let i = 3; i < small.data.length; i += 4) if ((small.data[i] ?? 0) > 64) ink += 1;
  const total = at16 * at16;
  const coverage = total > 0 ? ink / total : 0;
  const smallMask = new Uint8Array(total);
  for (let p = 0; p < total; p += 1) smallMask[p] = (small.data[p * 4 + 3] ?? 0) > 64 ? 1 : 0;
  const blobs = countBlobs(smallMask, at16, at16);

  const metrics: IconMetric[] = [];

  const readState: IconMetricState =
    coverage < 0.05 || coverage > 0.9 ? "ko" : blobs > 8 ? "ko" : coverage < 0.09 || blobs > 4 ? "watch" : "ok";
  metrics.push({
    id: "lisibilite",
    label: "Lisibilité à 16 px",
    state: readState,
    value: `${Math.round(coverage * 100)} % d'encre · ${blobs} tache${blobs > 1 ? "s" : ""}`,
    detail:
      readState === "ok"
        ? "À la taille d'un onglet, la forme reste identifiable et les détails ne se mélangent pas."
        : readState === "watch"
          ? "À 16 px, la lecture devient fragile : détails fins ou trop de petites taches. Simplifie le dessin."
          : coverage < 0.05
            ? "À 16 px, il ne reste presque rien : les traits sont trop fins pour un favicon."
            : coverage > 0.9
              ? "À 16 px, la forme devient un pâté plein : le dessin manque de vide autour."
              : "À 16 px, les éléments se transforment en confettis : trop de détails distincts pour un favicon.",
  });

  // Contraste de la couleur dominante sur les deux fonds d'onglet.
  const dominant = dominantInkColor(icon);
  if (dominant) {
    const lum = luminance(dominant.r, dominant.g, dominant.b);
    const onLight = contrast(LIGHT_BG, lum);
    const onDark = contrast(DARK_BG, lum);
    const best = Math.max(onLight, onDark);
    const both = Math.min(onLight, onDark);
    const state: IconMetricState = both >= 3 ? "ok" : best >= 3 ? "watch" : "ko";
    metrics.push({
      id: "contraste-onglet",
      label: "Contraste sur les onglets clair et sombre",
      state,
      value: `${onLight.toFixed(1)} : 1 clair · ${onDark.toFixed(1)} : 1 sombre`,
      detail:
        state === "ok"
          ? "La couleur dominante se détache sur les deux thèmes d'onglet."
          : state === "watch"
            ? "L'icône tient sur un thème mais se confond avec l'autre : prévois une variante claire ou sombre."
            : "La couleur dominante se confond avec le fond dans les deux thèmes : l'icône disparaît de l'onglet.",
    });
  }

  // Zone de sécurité maskable : le contenu utile doit tenir dans 80 % du carré.
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let outside = 0;
  let inked = 0;
  const cx = width / 2;
  const cy = height / 2;
  const radius = size * 0.4;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((icon.data[(y * width + x) * 4 + 3] ?? 0) < 64) continue;
      inked += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (Math.hypot(x - cx, y - cy) > radius) outside += 1;
    }
  }
  const share = inked > 0 ? outside / inked : 0;
  const zoneState: IconMetricState = share <= 0.01 ? "ok" : share <= 0.06 ? "watch" : "ko";
  metrics.push({
    id: "zone-maskable",
    label: "Zone de sécurité maskable",
    state: zoneState,
    value: `${Math.round(share * 100)} % hors zone`,
    detail:
      zoneState === "ok"
        ? "Tout le dessin tient dans le cercle de sécurité : Android et les icônes masquées ne coupent rien d'utile."
        : zoneState === "watch"
          ? "Quelques éléments débordent du cercle de sécurité : ils risquent d'être rognés sur Android."
          : "Une grande partie du dessin sort de la zone de sécurité : l'icône sera rognée sur Android et en PWA. Le dessin doit être recentré et réduit.",
  });

  const counts: Record<IconMetricState, number> = { ok: 0, watch: 0, ko: 0 };
  for (const metric of metrics) counts[metric.state] += 1;
  const needsRedesign = counts.ko > 0;

  const verdict = needsRedesign
    ? "Cette icône ne tient pas en favicon : une refonte de l'icône est nécessaire avant de la déployer sur un site, un onglet ou une app."
    : counts.watch > 0
      ? "L'icône passe, mais un point mérite d'être retravaillé pour tenir sur tous les supports."
      : "L'icône tient à toutes les tailles testées : onglet, favoris, écran d'accueil et icône masquée.";

  return { metrics, verdict, counts, needsRedesign };
}

/** Réduction par moyenne de blocs, sans dépendre du canvas (testable). */
export function downsample(px: Pixels, targetWidth: number, targetHeight: number): Pixels {
  const out = new Uint8ClampedArray(targetWidth * targetHeight * 4);
  const blockX = px.width / targetWidth;
  const blockY = px.height / targetHeight;
  for (let ty = 0; ty < targetHeight; ty += 1) {
    for (let tx = 0; tx < targetWidth; tx += 1) {
      const x0 = Math.floor(tx * blockX);
      const x1 = Math.max(x0 + 1, Math.min(px.width, Math.ceil((tx + 1) * blockX)));
      const y0 = Math.floor(ty * blockY);
      const y1 = Math.max(y0 + 1, Math.min(px.height, Math.ceil((ty + 1) * blockY)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * px.width + x) * 4;
          const alpha = px.data[i + 3] ?? 0;
          r += (px.data[i] ?? 0) * alpha;
          g += (px.data[i + 1] ?? 0) * alpha;
          b += (px.data[i + 2] ?? 0) * alpha;
          a += alpha;
          n += 1;
        }
      }
      const o = (ty * targetWidth + tx) * 4;
      out[o] = a > 0 ? r / a : 0;
      out[o + 1] = a > 0 ? g / a : 0;
      out[o + 2] = a > 0 ? b / a : 0;
      out[o + 3] = n > 0 ? a / n : 0;
    }
  }
  return { data: out, width: targetWidth, height: targetHeight };
}
