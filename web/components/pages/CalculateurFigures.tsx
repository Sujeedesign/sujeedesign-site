/**
 * Figures éditoriales de la page calculateur.
 *
 * Trois schémas construits en HTML/CSS (aucune image bitmap, aucun script) : ils sont
 * rendus côté serveur, lisibles sans JavaScript, et suivent la grammaire visuelle du site
 * (traits fins, étiquettes en mono, accent orange, rayons 3 px).
 * Chaque figure est décorative au sens ARIA : le texte qui l'accompagne porte l'information,
 * la figure porte une description courte pour les lecteurs d'écran.
 */
import styles from "./CalculateurFigures.module.css";

const ETAPES = [
  { nom: "Cadrage", logo: 1.5, identite: 4 },
  { nom: "Recherche", logo: 3, identite: 6 },
  { nom: "Pistes", logo: 4.5, identite: 11 },
  { nom: "Ajustements", logo: 3, identite: 8 },
  { nom: "Déclinaisons", logo: 2.5, identite: 8 },
  { nom: "Fichiers", logo: 0.5, identite: 4 },
];

const TOTAL_LOGO = ETAPES.reduce((n, e) => n + e.logo, 0);
const TOTAL_IDENTITE = ETAPES.reduce((n, e) => n + e.identite, 0);

/** Figure 1 : ce que produit une plateforme, ce que produit un studio. */
export function ComparaisonParcours() {
  return (
    <figure className={styles.figure}>
      <div className={styles.compare}>
        <div className={styles.panel}>
          <p className={styles.panelHead}>
            <span>Plateforme, 200 €</span>
            <span className={styles.panelTag}>1 étape</span>
          </p>
          <ol className={styles.single}>
            <li>
              <span className={styles.dot} aria-hidden="true" />
              Un fichier, livré sans source
            </li>
            <li>
              <span className={styles.dot} aria-hidden="true" />
              Aucune déclinaison
            </li>
            <li>
              <span className={styles.dot} aria-hidden="true" />
              Aucune vérification d&apos;antériorité
            </li>
          </ol>
          <p className={styles.panelNote}>
            Vous choisissez dans une galerie, sans échange préalable sur votre marché.
          </p>
        </div>

        <div className={`${styles.panel} ${styles.panelAccent}`}>
          <p className={styles.panelHead}>
            <span>Studio, 600 à 1 500 €</span>
            <span className={styles.panelTag}>6 étapes</span>
          </p>
          <ol className={styles.steps}>
            {["Cadrage", "Recherche", "Pistes", "Ajustements", "Déclinaisons", "Fichiers et droits"].map(
              (etape, i) => (
                <li key={etape}>
                  <span className={styles.num} aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {etape}
                </li>
              ),
            )}
          </ol>
          <p className={styles.panelNote}>Un interlocuteur, des décisions expliquées, des fichiers utilisables.</p>
        </div>
      </div>
      <figcaption className={styles.caption}>
        Fig. 1 — Deux façons d&apos;obtenir un logo : une livraison, ou un parcours de décisions.
      </figcaption>
    </figure>
  );
}

/** Figure 2 : répartition du temps de travail, en barres empilées. */
export function RepartitionTemps() {
  const max = Math.max(TOTAL_LOGO, TOTAL_IDENTITE);
  const barres = [
    { label: "Logo seul", total: TOTAL_LOGO, fourchette: "10 à 20 h" },
    { label: "Identité complète", total: TOTAL_IDENTITE, fourchette: "30 à 52 h" },
  ];

  return (
    <figure className={styles.figure}>
      <div className={styles.bars}>
        {barres.map((barre) => (
          <div className={styles.barRow} key={barre.label}>
            <p className={styles.barLabel}>
              {barre.label}
              <span>{barre.fourchette}</span>
            </p>
            <div className={styles.bar} role="img" aria-label={`${barre.label} : ${barre.fourchette}`}>
              {ETAPES.map((etape, i) => {
                const valeur = barre.label === "Logo seul" ? etape.logo : etape.identite;
                return (
                  <span
                    key={etape.nom}
                    className={styles.segment}
                    style={{ width: `${(valeur / max) * 100}%`, opacity: 0.9 - i * 0.13 }}
                    title={`${etape.nom} : ${valeur} h`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ul className={styles.legend}>
        {ETAPES.map((etape, i) => (
          <li key={etape.nom}>
            <span className={styles.swatch} style={{ opacity: 0.9 - i * 0.13 }} aria-hidden="true" />
            {etape.nom}
          </li>
        ))}
      </ul>
      <figcaption className={styles.caption}>
        Fig. 2 — Où part le temps : chaque segment est une étape, la longueur est proportionnelle aux heures.
      </figcaption>
    </figure>
  );
}

/** Figure 3 : ce que l'IA livre, ce qu'il reste à produire. */
const CONFRONTATIONS = [
  { avant: "Une image en pixels", apres: "Un tracé vectoriel" },
  { avant: "Des lettres imitées", apres: "Une typographie composée" },
  { avant: "Un visuel isolé", apres: "Un système de marque" },
];

export function IaVsDesigner() {
  return (
    <figure className={styles.figure}>
      <div className={styles.iaGrid}>
        <p className={styles.iaHead}>
          <span>Ce que l&apos;IA produit</span>
          <span>Ce qui reste à faire</span>
        </p>
        {CONFRONTATIONS.map((item) => (
          <div className={styles.iaRow} key={item.avant}>
            <span className={styles.iaCell}>{item.avant}</span>
            <svg className={styles.arrow} viewBox="0 0 24 8" aria-hidden="true" focusable="false">
              <line x1="0" y1="4" x2="18" y2="4" stroke="currentColor" strokeWidth="1.5" />
              <path d="M17 1 L22 4 L17 7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className={`${styles.iaCell} ${styles.iaAfter}`}>{item.apres}</span>
          </div>
        ))}
      </div>
      <figcaption className={styles.caption}>
        Fig. 3 — L&apos;IA produit une image ; la marque a besoin d&apos;un système exploitable.
      </figcaption>
    </figure>
  );
}
