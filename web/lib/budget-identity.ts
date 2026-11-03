/**
 * Calculateur de budget identité visuelle — données et règles.
 *
 * Source unique : la grille du brief P2 (`/opt/data/shared/briefs/P2-calculateur-budget-identite.md`).
 * Aucun prix n'est inventé ici : les fourchettes sont recopiées telles quelles, version publique
 * de la grille CRM. Les bornes basses s'additionnent entre elles, les bornes hautes aussi, sans
 * arrondi : un visiteur qui recompte à la main retrouve exactement le même total.
 */

export type Range = { low: number; high: number };

export type BaseId = "logo" | "declinaisons" | "complete" | "refonte";

export type OptionId = "charte" | "papeterie" | "packaging" | "reseaux" | "photo";

export type Base = {
  id: BaseId;
  /** Libellé du choix, tel qu'affiché sur le bouton radio. */
  label: string;
  /** Nom court utilisé dans le détail et le récapitulatif. */
  shortLabel: string;
  /** Note affichée sous le libellé. */
  note: string;
  /** Contenu du niveau (bloc « Ce qui est inclus dans chaque niveau »). */
  includes: string;
  range: Range;
};

export type Option = {
  id: OptionId;
  label: string;
  /** Nom court utilisé dans le détail et le récapitulatif. */
  shortLabel: string;
  range: Range;
};

export const BASES: readonly Base[] = [
  {
    id: "logo",
    label: "J'ai besoin d'un logo",
    shortLabel: "Logo",
    note: "création, 3 pistes",
    includes:
      "Trois pistes, une direction retenue, fichiers vectoriels et bitmap, versions couleur et monochrome.",
    range: { low: 600, high: 1500 },
  },
  {
    id: "declinaisons",
    label: "J'ai un logo, il faut le décliner",
    shortLabel: "Logo et déclinaisons",
    note: "versions mono, favicon, formats",
    includes:
      "La même chose qu'un logo, plus favicon, avatar réseaux, version horizontale et verticale, miniatures lisibles à 16 px.",
    range: { low: 800, high: 1500 },
  },
  {
    id: "complete",
    label: "Je pars de zéro, il me faut l'ensemble",
    shortLabel: "Identité complète",
    note: "logo, charte, guide d'usage",
    includes:
      "Logo, typographies, palette, règles d'usage, déclinaisons principales, guide d'usage.",
    range: { low: 1500, high: 4000 },
  },
  {
    id: "refonte",
    label: "Je refais une identité existante",
    shortLabel: "Refonte d'identité",
    note: "audit de l'existant et migration",
    includes:
      "Audit de l'existant, recommandation, nouvelle identité, plan de migration des supports, calendrier de bascule.",
    range: { low: 3000, high: 6000 },
  },
] as const;

export const OPTIONS: readonly Option[] = [
  {
    id: "charte",
    label: "Charte graphique détaillée",
    shortLabel: "charte graphique détaillée",
    range: { low: 900, high: 2500 },
  },
  {
    id: "papeterie",
    label: "Papeterie professionnelle",
    shortLabel: "papeterie",
    range: { low: 150, high: 500 },
  },
  {
    id: "packaging",
    label: "Packaging, une référence",
    shortLabel: "packaging",
    range: { low: 400, high: 1500 },
  },
  {
    id: "reseaux",
    label: "Déclinaisons réseaux sociaux",
    shortLabel: "déclinaisons réseaux sociaux",
    range: { low: 80, high: 300 },
  },
  {
    id: "photo",
    label: "Shooting photo, demi-journée",
    shortLabel: "shooting photo",
    range: { low: 350, high: 900 },
  },
] as const;

/** Bases qui embarquent déjà une charte graphique : l'option est alors désactivée. */
const CHARTE_INCLUSE: readonly BaseId[] = ["complete", "refonte"];

export function getBase(id: BaseId): Base {
  const base = BASES.find((item) => item.id === id);
  if (!base) throw new Error(`Base inconnue : ${id}`);
  return base;
}

export function getOption(id: OptionId): Option {
  const option = OPTIONS.find((item) => item.id === id);
  if (!option) throw new Error(`Option inconnue : ${id}`);
  return option;
}

/** Une option est désactivée quand le niveau de base l'inclut déjà. */
export function isOptionAvailable(id: OptionId, base: BaseId | null): boolean {
  if (id !== "charte") return true;
  return !(base !== null && CHARTE_INCLUSE.includes(base));
}

export type BudgetLine = {
  id: BaseId | OptionId;
  label: string;
  range: Range;
};

export type BudgetResult = {
  base: BaseId;
  options: OptionId[];
  /** Somme exacte des bornes, sans arrondi. */
  range: Range;
  /** Un poste par ligne, bornes non arrondies. */
  lines: BudgetLine[];
  /** Trois postes les plus lourds, calculés sur la borne haute. */
  top: string[];
  /** Récapitulatif copiable. */
  recap: string;
};

const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Montant lisible : `1 500 €`. */
export function formatEuro(value: number): string {
  return `${numberFormat.format(value)} €`;
}

export function formatRange(range: Range): string {
  return `${formatEuro(range.low)} à ${formatEuro(range.high)}`;
}

/**
 * Calcule la fourchette.
 *
 * Renvoie `null` tant qu'aucune base n'est choisie : c'est le cas limite « rien de
 * sélectionné », qui affiche le message d'invite au lieu d'un résultat vide.
 */
export function computeBudget(base: BaseId | null, options: readonly OptionId[]): BudgetResult | null {
  if (base === null) return null;

  const baseItem = getBase(base);
  const chosen = OPTIONS.filter(
    (option) => options.includes(option.id) && isOptionAvailable(option.id, base),
  );

  const lines: BudgetLine[] = [
    { id: baseItem.id, label: baseItem.shortLabel, range: baseItem.range },
    ...chosen.map((option) => ({ id: option.id, label: option.shortLabel, range: option.range })),
  ];

  const low = lines.reduce((total, line) => total + line.range.low, 0);
  const high = lines.reduce((total, line) => total + line.range.high, 0);

  const top = [...lines]
    .sort((a, b) => b.range.high - a.range.high)
    .slice(0, 3)
    .map((line) => line.label);

  const detail = lines
    .map((line) => `${line.label} (${formatRange(line.range)})`)
    .join(" + ");

  const recap = `${capitalize(detail)} : total estimé entre ${formatEuro(low)} et ${formatEuro(high)}.`;

  return { base, options: chosen.map((option) => option.id), range: { low, high }, lines, top, recap };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
