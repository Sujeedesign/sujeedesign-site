/**
 * Calculs de contraste WCAG, sans dépendance.
 *
 * La formule est celle du WCAG 2.2 : luminance relative pondérée par les
 * coefficients 0,2126 / 0,7152 / 0,0722, puis rapport (L1 + 0,05) / (L2 + 0,05).
 * Elle est identique à celle utilisée par le testeur de logo, pour que le site
 * ne donne jamais deux verdicts différents sur la même paire de couleurs.
 */

export type Rgb = { r: number; g: number; b: number };

/** Seuils WCAG 2.2, texte normal et grand texte (18,66 px gras ou 24 px). */
export const WCAG = {
  aaNormal: 4.5,
  aaLarge: 3,
  aaaNormal: 7,
  aaaLarge: 4.5,
} as const;

/** #abc, #aabbcc, abc, aabbcc, avec ou sans dièse. Renvoie null si invalide. */
export function parseHex(value: string): Rgb | null {
  const raw = value.trim().replace(/^#/, "").toLowerCase();
  const hex = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  if (!/^[0-9a-f]{6}$/.test(hex)) return null;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance({ r, g, b }: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport de contraste entre deux couleurs, arrondi à deux décimales. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

export type Verdict = {
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
};

export function verdict(ratio: number): Verdict {
  return {
    aaNormal: ratio >= WCAG.aaNormal,
    aaLarge: ratio >= WCAG.aaLarge,
    aaaNormal: ratio >= WCAG.aaaNormal,
    aaaLarge: ratio >= WCAG.aaaLarge,
  };
}

/** Texte noir ou blanc, celui qui contraste le mieux sur la couleur donnée. */
export function readableOn(color: Rgb): "#0a0a0b" | "#ffffff" {
  const white = contrast(color, { r: 255, g: 255, b: 255 });
  const black = contrast(color, { r: 10, g: 10, b: 11 });
  return black >= white ? "#0a0a0b" : "#ffffff";
}

export type Vision = "protanopie" | "deuteranopie" | "tritanopie" | "achromatopsie";

/**
 * Simulation de déficience visuelle par matrice linéaire (modèle de Brettel
 * simplifié, matrices usuelles en vision par ordinateur). Approximation
 * d'affichage : elle sert à repérer une paire qui s'effondre, pas à produire
 * une mesure clinique.
 */
const MATRICES: Record<Vision, [number, number, number, number, number, number, number, number, number]> = {
  protanopie: [0.567, 0.433, 0, 0.558, 0.442, 0, 0, 0.242, 0.758],
  deuteranopie: [0.625, 0.375, 0, 0.7, 0.3, 0, 0, 0.3, 0.7],
  tritanopie: [0.95, 0.05, 0, 0, 0.433, 0.567, 0, 0.475, 0.525],
  achromatopsie: [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
};

export function simulate(color: Rgb, vision: Vision): Rgb {
  const [a, b, c, d, e, f, g, h, i] = MATRICES[vision];
  return {
    r: a * color.r + b * color.g + c * color.b,
    g: d * color.r + e * color.g + f * color.b,
    b: g * color.r + h * color.g + i * color.b,
  };
}

export const VISIONS: { id: Vision; label: string }[] = [
  { id: "protanopie", label: "Protanopie" },
  { id: "deuteranopie", label: "Deutéranopie" },
  { id: "tritanopie", label: "Tritanopie" },
  { id: "achromatopsie", label: "Achromatopsie" },
];

/**
 * Teinte la plus proche qui atteint le seuil demandé, en gardant la teinte.
 *
 * Les canaux sont arrondis à l'entier avant chaque mesure : c'est la valeur
 * réellement affichée par `toHex`, donc c'est elle qu'il faut tester. Sans cet
 * arrondi, le ton proposé peut afficher 4,48:1 pour un seuil de 4,5:1.
 */
export function fixForeground(text: Rgb, background: Rgb, target = WCAG.aaNormal): Rgb {
  const round = (c: Rgb): Rgb => ({ r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b) });
  if (contrast(round(text), background) >= target) return round(text);

  const toward = readableOn(background) === "#ffffff" ? { r: 255, g: 255, b: 255 } : { r: 10, g: 10, b: 11 };
  const blend = (t: number): Rgb =>
    round({
      r: text.r + (toward.r - text.r) * t,
      g: text.g + (toward.g - text.g) * t,
      b: text.b + (toward.b - text.b) * t,
    });

  // Balayage grossier, puis affinage : on veut le ton le plus proche de
  // l'original, pas simplement un ton conforme.
  let low = 0;
  let high = 1;
  while (low < high) {
    const mid = (low + high) / 2;
    if (contrast(blend(mid), background) >= target) high = mid;
    else low = mid;
    if (high - low < 0.002) break;
  }
  const candidate = blend(high);
  // Sécurité : si l'arrondi a fait retomber sous le seuil, on force d'un cran.
  if (contrast(candidate, background) >= target) return candidate;
  let guard = candidate;
  for (let i = 0; i < 12; i += 1) {
    guard = {
      r: Math.round(guard.r + (toward.r - guard.r) * 0.02),
      g: Math.round(guard.g + (toward.g - guard.g) * 0.02),
      b: Math.round(guard.b + (toward.b - guard.b) * 0.02),
    };
    if (contrast(guard, background) >= target) return guard;
  }
  return toward;
}
