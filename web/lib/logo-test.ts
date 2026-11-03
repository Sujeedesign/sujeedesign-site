export type Pixels = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type MetricState = "ok" | "watch" | "ko";

export type Metric = {
  id: string;
  label: string;
  state: MetricState;
  value: string;
  detail: string;
};

export type LogoAnalysis = {
  metrics: Metric[];
  verdict: string;
  counts: Record<MetricState, number>;
};

/** Luminance relative WCAG d'une couleur opaque. */
export function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport de contraste WCAG entre deux luminances relatives. */
export function contrastRatio(a: number, b: number): number {
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return (light + 0.05) / (dark + 0.05);
}

const LIGHT_BG = relativeLuminance(247, 247, 245);
const DARK_BG = relativeLuminance(10, 10, 11);

/**
 * Mesures factuelles sur un logo déjà rendu en pixels.
 * Aucune note globale inventée : chaque critère est mesuré ou laissé à l'appréciation visuelle.
 */
export function analyseLogo(pixels: Pixels, naturalWidth: number, isVector: boolean): LogoAnalysis {
  const { data } = pixels;
  let opaque = 0;
  let translucent = 0;
  let minLum = 1;
  let maxLum = 0;
  const lums: number[] = [];

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3] ?? 0;
    if (alpha < 8) continue;
    if (alpha < 250) translucent += 1;
    opaque += 1;
    const lum = relativeLuminance(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
    lums.push(lum);
    if (lum < minLum) minLum = lum;
    if (lum > maxLum) maxLum = lum;
  }

  const metrics: Metric[] = [];

  // 1. Résolution
  if (isVector) {
    metrics.push({
      id: "resolution",
      label: "Résolution",
      state: "ok",
      value: "vectoriel",
      detail: "Le fichier est vectoriel : il se redimensionne sans perte, c'est le format de travail attendu.",
    });
  } else {
    const state: MetricState = naturalWidth >= 600 ? "ok" : naturalWidth >= 300 ? "watch" : "ko";
    metrics.push({
      id: "resolution",
      label: "Résolution",
      state,
      value: `${naturalWidth} px de large`,
      detail:
        state === "ok"
          ? "Assez de pixels pour les usages courants. Pour l'impression, il faudra un vectoriel."
          : state === "watch"
            ? "Juste suffisant à l'écran, insuffisant pour une enseigne ou un document imprimé."
            : "Trop petit : le logo sera flou dès qu'on l'agrandit.",
    });
  }

  // 2. Transparence
  const transparent = translucent > 0 || opaque < data.length / 4;
  metrics.push({
    id: "transparence",
    label: "Transparence",
    state: transparent ? "ok" : "watch",
    value: transparent ? "présente" : "fond opaque",
    detail: transparent
      ? "Le logo peut se poser sur n'importe quel fond sans rectangle blanc autour."
      : "Le fond est opaque : la version détourée manque pour les supports colorés.",
  });

  // 3. Contraste sur fond clair
  const onLight = contrastRatio(LIGHT_BG, minLum);
  metrics.push({
    id: "contraste-clair",
    label: "Contraste sur fond clair",
    state: onLight >= 4.5 ? "ok" : onLight >= 3 ? "watch" : "ko",
    value: `${onLight.toFixed(1)} : 1`,
    detail:
      onLight >= 4.5
        ? "La partie la plus sombre se détache nettement du papier."
        : onLight >= 3
          ? "Contraste limite : les éléments les plus clairs s'affadissent sur fond clair."
          : "Trop faible : une partie du logo disparaît sur fond clair.",
  });

  // 4. Contraste sur fond sombre
  const onDark = contrastRatio(DARK_BG, maxLum);
  metrics.push({
    id: "contraste-sombre",
    label: "Contraste sur fond sombre",
    state: onDark >= 4.5 ? "ok" : onDark >= 3 ? "watch" : "ko",
    value: `${onDark.toFixed(1)} : 1`,
    detail:
      onDark >= 4.5
        ? "Le logo se lit sur un fond encre sans retouche."
        : onDark >= 3
          ? "Contraste limite : prévoir une version claire pour les fonds sombres."
          : "Le logo se confond avec le fond : une déclinaison claire est nécessaire.",
  });

  // 5. Détails portés par la couleur
  const median = lums.length > 0 ? [...lums].sort((a, b) => a - b)[Math.floor(lums.length / 2)] ?? 0 : 0;
  const colourBound = lums.filter((lum) => Math.abs(lum - median) > 0.18).length;
  const share = lums.length > 0 ? colourBound / lums.length : 0;
  metrics.push({
    id: "un-ton",
    label: "Détails en un seul ton",
    state: share <= 0.12 ? "ok" : share <= 0.25 ? "watch" : "ko",
    value: `${Math.round(share * 100)} % de la surface`,
    detail:
      share <= 0.12
        ? "La forme tient en une seule couleur : le logo reste lisible en noir, en blanc et en gravure."
        : share <= 0.25
          ? "Une part notable du dessin dépend de la couleur. Vérifie la version en un ton avant de l'utiliser."
          : "Le dessin repose surtout sur des écarts de couleur : en un seul ton, il perd son sens.",
  });

  const counts: Record<MetricState, number> = { ok: 0, watch: 0, ko: 0 };
  for (const metric of metrics) counts[metric.state] += 1;

  const verdict =
    counts.ko === 0 && counts.watch === 0
      ? "Rien ne bloque dans les mesures. Reste à juger les aperçus ci-dessus à taille réelle."
      : counts.ko > 0
        ? `${counts.ko} point${counts.ko > 1 ? "s" : ""} bloquant${counts.ko > 1 ? "s" : ""} et ${counts.watch} à surveiller. Le plus urgent : ${firstLabel(metrics, "ko")}.`
        : `${counts.watch} point${counts.watch > 1 ? "s" : ""} à surveiller, aucun bloquant. ${firstLabel(metrics, "watch")} mérite une décision.`;

  return { metrics, verdict, counts };
}

function firstLabel(metrics: Metric[], state: MetricState): string {
  return metrics.find((metric) => metric.state === state)?.label ?? "à vérifier";
}

/** Extrait les pixels d'un canvas, prêt pour l'analyse. */
export function readPixels(canvas: HTMLCanvasElement): Pixels {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data, width, height };
}
