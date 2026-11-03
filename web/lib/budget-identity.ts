/**
 * Calculateur de budget identité visuelle — données et règles.
 *
 * Source unique : grille tarifaire validée par Sujee
 * (`/opt/data/shared/briefs/grille-tarifaire-logo-identite-visuelle.md`).
 * Aucun prix n'est inventé ici : les fourchettes sont recopiées telles quelles.
 * Les bornes basses s'additionnent entre elles, les bornes hautes aussi, sans
 * arrondi : un visiteur qui recompte à la main retrouve exactement le même total.
 */

export type Range = { low: number; high: number };

export type BaseId = "essentiel" | "refonte" | "signature" | "starter" | "complete" | "avance";

export type OptionId = "carte" | "email" | "post" | "brochure" | "picto" | "piste";

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
 * Six points de départ, classés par borne basse croissante : la progression de
 * prix reste lisible d'un bout à l'autre de la liste, y compris pour la refonte,
 * qui repart d'un logo existant et coûte donc moins qu'une création complète.
 */
export const BASES: readonly Base[] = [
  {
    id: "essentiel",
    label: "J'ai besoin d'un logo simple",
    shortLabel: "Logo Essentiel",
    note: "brief, 2 pistes, fichiers",
    includes:
      "Brief, deux pistes créatives, deux séries de retours, logo finalisé, fichiers AI, SVG, PNG et PDF, versions couleur, noir et blanc et fond transparent.",
    range: { low: 650, high: 900 },
  },
  {
    id: "refonte",
    label: "Je refais mon logo existant",
    shortLabel: "Refonte de logo",
    note: "reprise de l'existant, mise à niveau",
    includes:
      "Reprise du logo existant, nettoyage des tracés, remise à niveau des fichiers et des déclinaisons, sans repartir de zéro.",
    range: { low: 800, high: 1500 },
  },
  {
    id: "signature",
    label: "Je veux un logo durable et polyvalent",
    shortLabel: "Logo Signature",
    note: "3 pistes, déclinaisons, favicon",
    includes:
      "Brief approfondi, recherche concurrentielle, trois pistes, trois séries de retours, déclinaisons horizontale, verticale et icône, favicon, mini-guide PDF.",
    range: { low: 1200, high: 1800 },
  },
  {
    id: "starter",
    label: "Je lance mon activité",
    shortLabel: "Identité Starter",
    note: "logo, couleurs, typographies",
    includes:
      "Logo Signature, palette de couleurs, typographies, règles d'usage de base et mini brand book PDF.",
    range: { low: 1500, high: 2200 },
  },
  {
    id: "complete",
    label: "Je veux l'identité et ses supports",
    shortLabel: "Identité Complète",
    note: "logo décliné, modèles, guidelines",
    includes:
      "Identité Starter, logo décliné sur plusieurs supports, modèles réseaux sociaux, carte de visite, signature e-mail et guidelines détaillées.",
    range: { low: 2500, high: 3500 },
  },
  {
    id: "avance",
    label: "Je repositionne ma marque",
    shortLabel: "Branding Avancé",
    note: "positionnement, direction artistique, brand book",
    includes:
      "Atelier de positionnement, moodboard, direction artistique, univers graphique, pictogrammes, maquettes des supports clés et brand book complet.",
    range: { low: 4000, high: 6000 },
  },
] as const;

export const OPTIONS: readonly Option[] = [
  {
    id: "carte",
    label: "Carte de visite",
    shortLabel: "carte de visite",
    range: { low: 250, high: 450 },
  },
  {
    id: "email",
    label: "Signature e-mail",
    shortLabel: "signature e-mail",
    range: { low: 150, high: 300 },
  },
  {
    id: "post",
    label: "Modèle de post réseaux sociaux",
    shortLabel: "modèle de post réseaux sociaux",
    range: { low: 150, high: 350 },
  },
  {
    id: "brochure",
    label: "Plaquette ou brochure",
    shortLabel: "plaquette ou brochure",
    range: { low: 600, high: 1500 },
  },
  {
    id: "picto",
    label: "Pictogramme ou illustration",
    shortLabel: "pictogramme ou illustration",
    range: { low: 150, high: 400 },
  },
  {
    id: "piste",
    label: "Piste créative supplémentaire",
    shortLabel: "piste créative supplémentaire",
    range: { low: 250, high: 450 },
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
