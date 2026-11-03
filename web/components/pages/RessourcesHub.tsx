import Link from "next/link";
import { routes } from "@/lib/routes";
import styles from "./RessourcesHub.module.css";

export const pageMeta = {
  title: "Ressources : outils et guides de prix",
  description:
    "Un calculateur de budget, un guide des prix du logo, et les repères de temps pour situer un projet d'identité visuelle avant de demander un devis.",
};

const ENTREES = [
  {
    href: routes.calculateurBudgetIdentite,
    kind: "Outil",
    title: "Calculateur de budget identité visuelle",
    text:
      "Six points de départ, six options, une fourchette en trente secondes. Le détail du calcul s'affiche ligne par ligne, sans email à laisser.",
    more: "Estimer un budget",
  },
  {
    href: routes.guidePrixLogo,
    kind: "Guide",
    title: "Combien coûte un logo en 2026 ?",
    text:
      "Les quatre paliers de prix, ce qu'on obtient à chacun, le temps de travail réel, et ce qui manque dans un devis à 200 €.",
    more: "Lire le guide",
  },
  {
    href: routes.generateurBriefIdentite,
    kind: "Outil",
    title: "Générateur de brief identité",
    text:
      "Dix questions pour écrire un brief propre, avec ce qui bloque un projet. Export en PDF, rien n'est envoyé.",
    more: "Rédiger un brief",
  },
];

export function RessourcesHub() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1>
              Outils et repères
              <br />
              pour un <span style={{ color: "var(--accent)" }}>projet</span>
            </h1>
            <p className="intro">
              Deux entrées pour situer un budget et comprendre ce qu&apos;on achète. Rien à
              laisser en échange, aucun formulaire avant le devis.
            </p>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <div className={styles.grid}>
            {ENTREES.map((entree) => (
              <Link key={entree.href} href={entree.href} className={styles.card}>
                <span className={styles.kind}>{entree.kind}</span>
                <h2 className={styles.title}>{entree.title}</h2>
                <p className={styles.text}>{entree.text}</p>
                <span className={styles.more}>{entree.more} ↗</span>
              </Link>
            ))}
          </div>

          <p className={styles.note}>
            Ces pages complètent les services du studio : elles servent à savoir où vous mettez
            les pieds avant de parler budget. Si votre cas ne rentre dans aucune fourchette,
            écrivez-moi, le devis se construit sur votre périmètre.
          </p>
        </div>
      </section>

      <section className="cta-section">
        <div className="wrap">
          <div className="bandcta bandcta--dark cta-glow">
            <div className="glow" aria-hidden="true" />
            <p>Un projet, une question de budget ?</p>
            <Link className="btn-fill btn-fill--light" href={routes.contact}>
              Parler de votre projet <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
