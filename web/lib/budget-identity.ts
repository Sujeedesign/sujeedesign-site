/**
 * Calculateur de budget identité visuelle — données et règles.
 *
 * Source unique : grille tarifaire appliquée par Sujee, relevée dans le CRM le
 * 10 novembre 2026 (prestations actives, `tarif_ref` et fourchette de marché).
 * Aucun prix n'est inventé ici : la borne basse est le prix de départ affiché,
 * la borne haute le haut de la fourchette de marché constatée.
 * Les bornes basses s'additionnent entre elles, les bornes hautes aussi, sans
 * arrondi : un visiteur qui recompte à la main retrouve exactement le même total.
 */

export type Range = { low: number; high: number };

export type BaseId =
  | "logo"
  | "logo-declinaisons"
  | "charte"
  | "essentiel"
  | "complete"
  | "complet"
  | "rebranding";

export type OptionId = "carte" | "flyer" | "post" | "affiche" | "plaquette" | "menu";

export type Base = {
  id: BaseId;
  /** Libellé du choix, tel qu'affiché sur le bouton radio. */
  label: string;
  /** Nom de l'offre, utilisé dans le détail et le récapitulatif. */
  shortLabel: string;
  /** Note affichée sous le libellé. */
  note: string;
  /** Contenu de l'offre (bloc « Ce qui est inclus dans chaque niveau »). */
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

/**
 * Sept points de départ, classés par prix de départ croissant. Chaque niveau
 * reprend le travail du précédent : un logo décliné contient le logo, le pack
 * complet contient l'identité complète.
 *
 * La borne basse est le prix affiché par le studio, la borne haute le haut de
 * la fourchette de marché relevée pour le même périmètre (grille du 10 novembre
 * 2026). Un projet simple reste donc au prix affiché, un périmètre étendu monte
 * dans la fourchette, sans mauvaise surprise au devis.
 */
export const BASES: readonly Base[] = [
  {
    id: "logo",
    label: "J'ai besoin d'un logo",
    shortLabel: "Logo, 3 pistes",
    note: "brief, 3 pistes, 2 séries de retouches",
    includes:
      "Brief, trois pistes créatives, deux séries de retouches, logo finalisé, fichiers AI, SVG, PNG et PDF, versions couleur, noir et blanc et fond transparent, cession de droits écrite.",
    range: { low: 800, high: 1500 },
  },
  {
    id: "logo-declinaisons",
    label: "Je veux un logo déjà décliné",
    shortLabel: "Logo + déclinaisons",
    note: "déclinaisons horizontal, vertical, icône",
    includes:
      "Le logo et ses déclinaisons principales : version horizontale, verticale, icône, favicon, une couleur et fond sombre, avec les exports correspondants.",
    range: { low: 1100, high: 1500 },
  },
  {
    id: "charte",
    label: "J'ai mon logo, il me faut la charte",
    shortLabel: "Charte graphique",
    note: "palette, typographies, règles d'usage",
    includes:
      "Reprise du logo existant, palette de couleurs, typographies, règles d'usage et guide de la charte en PDF, prêt à transmettre à un imprimeur ou à un développeur.",
    range: { low: 1200, high: 2500 },
  },
  {
    id: "essentiel",
    label: "Je veux l'identité et ses premiers supports",
    shortLabel: "Pack Identité Essentiel",
    note: "logo décliné, charte, deux supports",
    includes:
      "Logo et déclinaisons, charte graphique et deux supports au choix parmi carte de visite, papier en-tête, signature e-mail ou modèle de post.",
    range: { low: 1900, high: 3000 },
  },
  {
    id: "complete",
    label: "Je veux une identité visuelle complète",
    shortLabel: "Identité visuelle complète",
    note: "logo, charte et déclinaisons principales",
    includes:
      "Logo, charte graphique et déclinaisons principales sur les supports courants, avec les fichiers sources et le guide d'usage.",
    range: { low: 2200, high: 4000 },
  },
  {
    id: "complet",
    label: "Je veux une identité étendue",
    shortLabel: "Pack Identité Complet",
    note: "charte étendue, quatre supports, réseaux",
    includes:
      "Identité complète, charte étendue, quatre supports au choix et déclinaisons réseaux sociaux, avec les fichiers sources et la cession de droits.",
    range: { low: 3200, high: 5000 },
  },
  {
    id: "rebranding",
    label: "Je repositionne ma marque",
    shortLabel: "Rebranding",
    note: "refonte de l'identité existante",
    includes:
      "Audit de l'identité existante, repositionnement, refonte du logo et de la charte, déclinaisons et plan de déploiement des supports.",
    range: { low: 3500, high: 6000 },
  },
] as const;

/** Options chiffrées, ajoutées au niveau retenu. Bornes issues de la grille du 10/11/2026. */
export const OPTIONS: readonly Option[] = [
  {
    id: "carte",
    label: "Carte de visite recto-verso",
    shortLabel: "carte de visite",
    range: { low: 180, high: 350 },
  },
  {
    id: "flyer",
    label: "Flyer A5 ou A6 recto-verso",
    shortLabel: "flyer",
    range: { low: 220, high: 450 },
  },
  {
    id: "post",
    label: "Post réseaux sociaux",
    shortLabel: "post réseaux sociaux",
    range: { low: 40, high: 80 },
  },
  {
    id: "affiche",
    label: "Affiche A2",
    shortLabel: "affiche A2",
    range: { low: 320, high: 500 },
  },
  {
    id: "plaquette",
    label: "Plaquette commerciale 4 à 8 pages",
    shortLabel: "plaquette commerciale",
    range: { low: 710, high: 1500 },
  },
  {
    id: "menu",
    label: "Menu ou carte de restaurant",
    shortLabel: "menu de restaurant",
    range: { low: 180, high: 350 },
  },
] as const;

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
  const chosen = OPTIONS.filter((option) => options.includes(option.id));

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
