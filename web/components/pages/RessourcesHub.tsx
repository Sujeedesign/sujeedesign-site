import Link from "next/link";
import { routes } from "@/lib/routes";
import {
  BriefPreview,
  CalculateurPreview,
  GuidePreview,
  LogoPreview,
} from "./RessourcesPreviews";
import styles from "./RessourcesHub.module.css";

export const pageMeta = {
  title: "Ressources : outils et guides de prix",
  description:
    "Un calculateur de budget, deux guides de prix, un test de logo et un générateur de brief. Cinq pages pour situer un projet avant de demander un devis.",
};

const PRINCIPAL = {
  href: routes.calculateurBudgetIdentite,
  num: "01",
  kind: "Outil",
  title: "Calculateur de budget identité visuelle",
  text:
    "Sept points de départ, six options, une fourchette en trente secondes. Le détail du calcul s'affiche ligne par ligne, sans email à laisser.",
  more: "Estimer un budget",
};

const AUTRES = [
  {
    href: routes.guidePrixLogo,
    num: "02",
    kind: "Guide",
    title: "Combien coûte un logo en 2026 ?",
    text:
      "Les quatre paliers de prix, le temps de travail réel, et ce qui manque dans un devis à 200 €.",
    more: "Lire le guide",
    preview: <GuidePreview />,
  },
  {
    href: routes.guidePrixSite,
    num: "03",
    kind: "Guide",
    title: "Combien coûte un site internet en 2026 ?",
    text:
      "Les quatre paliers de prix, les coûts récurrents que personne n'annonce, et le prix réel d'un site vitrine.",
    more: "Lire le guide",
    preview: <GuidePreview />,
  },
  {
    href: routes.testerSonLogo,
    num: "04",
    kind: "Diagnostic",
    title: "Tester son logo",
    text:
      "Votre logo à 16 pixels, en gris, en un seul ton. Le fichier reste dans votre navigateur.",
    more: "Tester le logo",
    preview: <LogoPreview />,
  },
  {
    href: routes.generateurBriefIdentite,
    num: "05",
    kind: "Outil",
    title: "Générateur de brief identité",
    text:
      "Dix questions pour écrire un brief propre, avec ce qui bloque un projet. Export en PDF.",
    more: "Rédiger un brief",
    preview: <BriefPreview />,
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
              Quatre pages pour situer un budget, tester un logo et écrire un brief. Rien à
              laisser en échange, aucun formulaire avant le devis.
            </p>
            <p className={styles.meta}>
              <span>4 pages</span>
              <span>Gratuit</span>
              <span>Sans inscription</span>
            </p>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <Link href={PRINCIPAL.href} className={styles.featured}>
            <div className={styles.featuredBody}>
              <div className={styles.featuredTop}>
                <span className={styles.num}>{PRINCIPAL.num}</span>
                <span className={styles.kind}>{PRINCIPAL.kind}</span>
              </div>
              <h2 className={styles.featuredTitle}>{PRINCIPAL.title}</h2>
              <p className={styles.text}>{PRINCIPAL.text}</p>
              <span className={styles.cta}>
                {PRINCIPAL.more} <span aria-hidden="true">↗</span>
              </span>
            </div>
            <div className={styles.previewSlot}>
              <CalculateurPreview />
            </div>
          </Link>

          <div className={styles.grid}>
            {AUTRES.map((entree) => (
              <Link key={entree.href} href={entree.href} className={styles.card}>
                <div className={styles.previewSlot}>{entree.preview}</div>
                <div className={styles.cardHead}>
                  <span className={styles.num}>{entree.num}</span>
                  <span className={styles.kind}>{entree.kind}</span>
                </div>
                <h2 className={styles.cardTitle}>{entree.title}</h2>
                <p className={styles.cardText}>{entree.text}</p>
                <span className={styles.cta}>
                  {entree.more} <span aria-hidden="true">↗</span>
                </span>
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
