import { GuideFigure } from "@/components/guides/GuideFigure";
import styles from "./GuideIllu.module.css";

/**
 * Illustrations du guide « agence ou freelance ».
 *
 * Trois schémas dessinés en SVG, sans image bitmap : ils restent nets à toutes
 * les tailles, pèsent quelques kilo-octets et reprennent la charte du site
 * (encre noire, accent orange, filets fins).
 *
 * Les animations sont en CSS pur, donc sans JavaScript. Elles se coupent
 * entièrement sous `prefers-reduced-motion` (règle en fin de module) : le
 * schéma reste lisible, simplement figé.
 *
 * Le cadre (panneau, titre accessible, légende, défilement mobile) vient de
 * GuideFigure : une illustration ne fournit que son dessin, jamais son propre
 * panneau.
 */

/* ------------------------------------------------------------------ */
/* 1. Trois façons de faire un projet                                  */
/* ------------------------------------------------------------------ */

const AGENCE = [
  { x: 44, y: 38, d: 0.1 },
  { x: 120, y: 22, d: 0.25 },
  { x: 134, y: 96, d: 0.4 },
  { x: 62, y: 122, d: 0.55 },
  { x: 18, y: 82, d: 0.7 },
];

export function IlluTroisOptions() {
  return (
    <GuideFigure
      viewBox="0 0 820 250"
      titre="Trois façons de mener un projet : une agence avec cinq métiers reliés, un studio à deux têtes, un freelance seul."
      legende={
        <>
          Le nombre de personnes à coordonner décide du coût réel. Une agence relie cinq métiers,
          un freelance n&apos;a personne à synchroniser.
        </>
      }
    >
      {/* Colonne 1 : l'agence */}
      <g transform="translate(70, 32)">
        <text x="84" y="-6" className={styles.kick} textAnchor="middle">
          AGENCE
        </text>
        {AGENCE.map((n, i) => (
          <line
            key={`l${i}`}
            x1="84"
            y1="70"
            x2={n.x}
            y2={n.y}
            className={styles.wire}
            style={{ animationDelay: `${n.d}s` }}
          />
        ))}
        {AGENCE.map((n, i) => (
          <circle
            key={`n${i}`}
            cx={n.x}
            cy={n.y}
            r="9"
            className={styles.node}
            style={{ animationDelay: `${n.d + 0.15}s` }}
          />
        ))}
        <rect x="62" y="48" width="44" height="44" rx="6" className={styles.core} />
        <text x="84" y="75" className={styles.coreMark} textAnchor="middle">
          5
        </text>
        <text x="84" y="158" className={styles.label} textAnchor="middle">
          5 métiers, 1 chef de projet
        </text>
      </g>

      {/* Colonne 2 : le studio */}
      <g transform="translate(330, 32)">
        <text x="80" y="-6" className={styles.kick} textAnchor="middle">
          STUDIO
        </text>
        <line x1="46" y1="54" x2="114" y2="88" className={styles.wireSolid} />
        <circle cx="46" cy="54" r="11" className={styles.node} />
        <circle cx="114" cy="88" r="11" className={styles.core} />
        <text x="80" y="158" className={styles.label} textAnchor="middle">
          2 têtes, 1 direction
        </text>
      </g>

      {/* Colonne 3 : le freelance */}
      <g transform="translate(600, 32)">
        <text x="76" y="-6" className={styles.kick} textAnchor="middle">
          FREELANCE
        </text>
        <circle cx="76" cy="70" r="36" className={styles.orbit} />
        <circle cx="76" cy="70" r="22" className={`${styles.orbit} ${styles.orbit2}`} />
        <circle cx="76" cy="70" r="13" className={styles.core} />
        <circle cx="76" cy="70" r="3.4" className={styles.spark} />
        <text x="76" y="158" className={styles.label} textAnchor="middle">
          1 personne, 1 métier
        </text>
      </g>
    </GuideFigure>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Le coût de la coordination                                       */
/* ------------------------------------------------------------------ */

// Hexagone régulier : six nœuds, quinze liens, sans croisement superflu.
const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return { x: 92 + 60 * Math.cos(a), y: 92 + 60 * Math.sin(a) };
});

export function IlluCoordination() {
  const links: { x1: number; y1: number; x2: number; y2: number; d: number }[] = [];
  HEX.forEach((a, i) => {
    HEX.slice(i + 1).forEach((b) => {
      links.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, d: 0.04 * links.length });
    });
  });

  return (
    <GuideFigure
      viewBox="0 0 820 240"
      titre="Six personnes produisent quinze liens à entretenir, deux personnes un seul."
      legende={
        <>
          Chaque trait est une réunion, une relecture, une validation. C&apos;est ce que paie le
          surcoût d&apos;une agence, et c&apos;est aussi ce qui la rend utile quand le volume
          l&apos;exige.
        </>
      }
    >
      <g transform="translate(140, 18)">
        <text x="92" y="0" className={styles.kick} textAnchor="middle">
          6 PERSONNES
        </text>
        {links.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            className={styles.wireDense}
            style={{ animationDelay: `${l.d}s` }}
          />
        ))}
        {HEX.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r="8.5" className={styles.node} />
        ))}
        <text x="92" y="190" className={styles.bigNumber} textAnchor="middle">
          15
        </text>
        <text x="92" y="212" className={styles.label} textAnchor="middle">
          échanges à entretenir
        </text>
      </g>

      <g transform="translate(560, 18)">
        <text x="92" y="0" className={styles.kick} textAnchor="middle">
          2 PERSONNES
        </text>
        <line x1="46" y1="72" x2="138" y2="72" className={styles.wireSolid} />
        <circle cx="46" cy="72" r="14" className={styles.node} />
        <circle cx="138" cy="72" r="14" className={styles.core} />
        <text x="92" y="190" className={styles.bigNumber} textAnchor="middle">
          1
        </text>
        <text x="92" y="212" className={styles.label} textAnchor="middle">
          échange
        </text>
      </g>

      <line x1="356" y1="110" x2="404" y2="110" className={styles.arrow} />
      <path d="M404 104 L418 110 L404 116 Z" className={styles.arrowHead} />
    </GuideFigure>
  );
}

/* ------------------------------------------------------------------ */
/* 3. La grille de décision                                            */
/* ------------------------------------------------------------------ */

export function IlluDecision() {
  return (
    <GuideFigure
      viewBox="0 0 820 300"
      titre="Arbre de décision : plusieurs métiers en parallèle mènent à l'agence, sinon un brief écrit mène au freelance, sinon au studio."
      legende="La décision tient à deux questions. Le format du prestataire vient après, jamais avant."
    >
      {/* Question 1 */}
      <g transform="translate(60, 40)">
        <rect x="0" y="0" width="200" height="60" rx="6" className={styles.card} />
        <text x="16" y="26" className={styles.label}>
          Plusieurs métiers
        </text>
        <text x="16" y="46" className={styles.label}>
          en même temps ?
        </text>
      </g>

      {/* oui → agence */}
      <path
        d="M260 58 L 380 58 L 380 40 L 470 40"
        className={`${styles.path} ${styles.pathAccent}`}
      />
      <text x="272" y="50" className={styles.tagAccent}>
        oui
      </text>
      <g transform="translate(470, 14)">
        <rect x="0" y="0" width="170" height="52" rx="6" className={styles.cardAccent} />
        <text x="16" y="22" className={styles.labelAccent}>
          Agence
        </text>
        <text x="16" y="40" className={styles.labelAccent}>
          5 métiers, 1 projet
        </text>
      </g>

      {/* non → question 2 */}
      <path d="M260 82 L 260 152 L 320 152" className={styles.path} />
      <text x="268" y="112" className={styles.tag}>
        non
      </text>
      <g transform="translate(320, 120)">
        <rect x="0" y="0" width="210" height="60" rx="6" className={styles.card} />
        <text x="16" y="26" className={styles.label}>
          Un brief écrit
        </text>
        <text x="16" y="46" className={styles.label}>
          existe déjà ?
        </text>
      </g>

      {/* oui → freelance */}
      <path d="M530 138 L 620 138 L 620 122 L 660 122" className={styles.path} />
      <text x="538" y="130" className={styles.tagAccent}>
        oui
      </text>
      <g transform="translate(660, 96)">
        <rect x="0" y="0" width="150" height="52" rx="6" className={styles.cardAccent} />
        <text x="14" y="22" className={styles.labelAccent}>
          Freelance
        </text>
        <text x="14" y="40" className={styles.labelAccent}>
          1 métier, direct
        </text>
      </g>

      {/* non → studio */}
      <path d="M530 168 L 620 168 L 620 240 L 660 240" className={styles.path} />
      <text x="538" y="196" className={styles.tag}>
        non
      </text>
      <g transform="translate(660, 214)">
        <rect x="0" y="0" width="150" height="52" rx="6" className={styles.card} />
        <text x="14" y="22" className={styles.label}>
          Studio
        </text>
        <text x="14" y="40" className={styles.label}>
          cadre le brief
        </text>
      </g>

      <text x="60" y="290" className={styles.note}>
        Le brief décide plus que le format du prestataire.
      </text>
    </GuideFigure>
  );
}
