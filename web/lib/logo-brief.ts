import { BASES, formatRange } from "./budget-identity";

export type ExistingId = "aucun" | "ancien" | "fichiers";

export type BriefAnswers = {
  activity: string;
  pitch: string;
  clients: string;
  references: string;
  difference: string;
  traits: readonly string[];
  supports: readonly string[];
  colorsYes: string;
  colorsNo: string;
  existing: ExistingId;
  deadline: string;
  budget: string;
};

export const TRAITS = [
  "Sobre",
  "Chaleureux",
  "Premium",
  "Artisanal",
  "Technique",
  "Populaire",
  "Institutionnel",
  "Audacieux",
  "Minimal",
  "Festif",
  "Local",
  "Familial",
] as const;

export const SUPPORTS = [
  { id: "logo", label: "Le logo seul" },
  { id: "carte", label: "Carte de visite" },
  { id: "email", label: "Signature e-mail" },
  { id: "reseaux", label: "Réseaux sociaux" },
  { id: "enseigne", label: "Enseigne ou vitrine" },
  { id: "web", label: "Site web" },
  { id: "papier", label: "Papeterie et documents" },
  { id: "vehicule", label: "Véhicule ou tenue" },
] as const;

export const EXISTING: readonly { id: ExistingId; label: string }[] = [
  { id: "aucun", label: "Rien du tout, on part de zéro" },
  { id: "ancien", label: "Un logo existe mais il est daté" },
  { id: "fichiers", label: "Un logo existe mais je n'ai aucun fichier propre" },
];

export const BUDGETS: readonly string[] = [
  ...BASES.map((base) => formatRange(base.range)),
  "Je ne sais pas encore",
];

export type Step = {
  id: keyof BriefAnswers | "traits" | "supports";
  num: number;
  title: string;
  why: string;
  error: string;
};

export const STEPS: readonly Step[] = [
  {
    id: "activity",
    num: 1,
    title: "Le nom et l'activité",
    why: "Le nom décide de la longueur, des lettres à éviter et des collisions possibles avec l'existant.",
    error: "Un brief qui commence par « je veux un logo moderne » n'a rien dit. Le métier d'abord.",
  },
  {
    id: "pitch",
    num: 2,
    title: "Ce que vous vendez, en une phrase",
    why: "C'est la phrase qu'on gardera sous les yeux pendant tout le projet. Si elle tient en une ligne, le reste suit.",
    error: "Lister six services dans la phrase. Une marque qui vend tout ne signale rien.",
  },
  {
    id: "clients",
    num: 3,
    title: "À qui vous parlez",
    why: "Un logo pour des particuliers de 60 ans et un logo pour des acheteurs techniques ne se ressemblent pas.",
    error: "« Tout le monde » est une réponse, mais elle ramène à une identité neutre, donc oubliable.",
  },
  {
    id: "references",
    num: 4,
    title: "Trois marques de référence",
    why: "Deux ou trois exemples valent mieux qu'une page d'adjectifs : ils montrent un niveau de finition et un ton.",
    error: "Donner des logos de multinationales. Ce n'est pas un budget, c'est une intention, et il faut le dire.",
  },
  {
    id: "difference",
    num: 5,
    title: "Ce qui vous différencie vraiment",
    why: "Le studio travaille avec ça. Sans différenciation, on produit un joli logo interchangeable.",
    error: "« Le service et la qualité ». Les concurrents disent exactement la même chose.",
  },
  {
    id: "traits",
    num: 6,
    title: "Trois adjectifs, pas dix",
    why: "Trois adjectifs dessinent une direction. Dix adjectifs se contredisent et ramènent au milieu.",
    error: "Sobre et festif en même temps. Il faudra choisir, autant le faire maintenant.",
  },
  {
    id: "supports",
    num: 7,
    title: "Où le logo va vivre",
    why: "Un logo pensé pour une enseigne et un logo pensé pour un favicon n'ont pas les mêmes contraintes.",
    error: "Oublier la déclinaison en un seul ton. C'est le cas qui casse le plus de logos.",
  },
  {
    id: "colorsYes",
    num: 8,
    title: "Couleurs à éviter, et celles que vous aimez",
    why: "Les deux comptent : ce qu'on aime donne le ton, ce qu'on évite évite un aller-retour.",
    error: "Imposer un code couleur avant d'avoir parlé du positionnement.",
  },
  {
    id: "existing",
    num: 9,
    title: "Ce qui existe déjà",
    why: "Un ancien logo à conserver, des fichiers perdus, un nom à ne pas toucher : ça change le périmètre.",
    error: "Découvrir au milieu du projet qu'il fallait garder le symbole existant.",
  },
  {
    id: "deadline",
    num: 10,
    title: "Une échéance et une fourchette de budget",
    why: "Une échéance fixe un rythme, une fourchette fixe le niveau de finition. Les deux ensemble évitent les malentendus.",
    error: "Annoncer une date sans marge, puis rogner sur les tests de lisibilité.",
  },
];

export function emptyBrief(): BriefAnswers {
  return {
    activity: "",
    pitch: "",
    clients: "",
    references: "",
    difference: "",
    traits: [],
    supports: [],
    colorsYes: "",
    colorsNo: "",
    existing: "aucun",
    deadline: "",
    budget: "",
  };
}

const REQUIRED: readonly (keyof BriefAnswers)[] = [
  "activity",
  "pitch",
  "clients",
  "difference",
  "traits",
  "supports",
  "budget",
];

export function isFilled(value: BriefAnswers[keyof BriefAnswers]): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return String(value).trim().length > 0;
}

export function completeness(answers: BriefAnswers): {
  filled: number;
  total: number;
  missing: string[];
} {
  const missing = REQUIRED.filter((key) => !isFilled(answers[key])).map((key) => {
    const step = STEPS.find((item) => item.id === key);
    return step ? step.title : String(key);
  });
  return { filled: REQUIRED.length - missing.length, total: REQUIRED.length, missing };
}

function line(label: string, value: string): string {
  const clean = value.trim();
  return `${label} : ${clean.length > 0 ? clean : "à compléter"}`;
}

export function briefToText(answers: BriefAnswers): string {
  const existing = EXISTING.find((item) => item.id === answers.existing);
  const supports = answers.supports
    .map((id) => SUPPORTS.find((item) => item.id === id)?.label ?? id)
    .join(", ");

  return [
    "BRIEF IDENTITÉ VISUELLE",
    "",
    line("Activité", answers.activity),
    line("Ce que je vends", answers.pitch),
    line("Clients visés", answers.clients),
    line("Références", answers.references),
    line("Différenciation", answers.difference),
    line("Adjectifs", answers.traits.join(", ")),
    line("Supports à prévoir", supports),
    line("Couleurs à éviter", answers.colorsNo),
    line("Couleurs appréciées", answers.colorsYes),
    line("Existant", existing ? existing.label : "à compléter"),
    line("Échéance", answers.deadline),
    line("Budget", answers.budget),
    "",
    "Ce brief a été préparé avec le générateur de Sujee Design.",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function briefToHtml(answers: BriefAnswers): string {
  const rows: [string, string][] = [
    ["Activité", answers.activity],
    ["Ce que je vends", answers.pitch],
    ["Clients visés", answers.clients],
    ["Références", answers.references],
    ["Différenciation", answers.difference],
    ["Adjectifs", answers.traits.join(", ")],
    [
      "Supports à prévoir",
      answers.supports.map((id) => SUPPORTS.find((item) => item.id === id)?.label ?? id).join(", "),
    ],
    ["Couleurs à éviter", answers.colorsNo],
    ["Couleurs appréciées", answers.colorsYes],
    ["Existant", EXISTING.find((item) => item.id === answers.existing)?.label ?? ""],
    ["Échéance", answers.deadline],
    ["Budget", answers.budget],
  ];

  const body = rows
    .map(([label, value]) => {
      const clean = value.trim();
      return `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(
        clean.length > 0 ? clean : "à compléter",
      )}</td></tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Brief identité visuelle</title>
<style>
  @page { margin: 18mm; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #0A0A0B; font-size: 11pt; line-height: 1.55; }
  h1 { font-size: 20pt; margin: 0 0 4px; letter-spacing: -0.02em; }
  p.sub { margin: 0 0 22px; color: #55555A; font-size: 9.5pt; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 8px 0; border-bottom: 1px solid #D8D8D2; }
  th { width: 30%; font-weight: 600; }
  footer { margin-top: 22px; font-size: 8.5pt; color: #55555A; }
</style>
</head>
<body>
<h1>Brief identité visuelle</h1>
<p class="sub">Préparé avec le générateur de Sujee Design · sujeedesign.com</p>
<table>
${body}
</table>
<footer>Les mentions « à compléter » sont les points à traiter avant le premier échange.</footer>
</body>
</html>`;
}
