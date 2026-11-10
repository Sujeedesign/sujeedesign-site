import Link from "next/link";
import { routes } from "@/lib/routes";
import styles from "./RessourcesHub.module.css";

export const pageMeta = {
  title: "Ressources gratuites : guides de prix et outils",
  description:
    "Six outils gratuits pour cadrer un projet avant le devis : guides de prix, calculateur, test de logo, brief et cahier des charges. Sans inscription.",
};

type Cover =
  | "cahier-des-charges"
  | "creer-un-logo"
  | "identite-visuelle"
  | "site-internet"
  | "brief-identite"
  | "testeur-de-logo";

type Entree = {
  href: string;
  num: string;
  kind: string;
  title: string;
  text: string;
  more: string;
  cover: Cover;
  alt: string;
};

/** Trois pages pour situer un budget. */
const BUDGET: Entree[] = [
  {
    href: routes.calculateurBudgetIdentite,
    num: "01",
    kind: "Calculateur",
    title: "Budget d'une identité visuelle",
    text:
      "Sept points de départ, six options, une fourchette en trente secondes, calculée ligne par ligne.",
    more: "Estimer un budget",
    cover: "identite-visuelle",
    alt: "Planche de construction d'un logo annotée sur un bureau de studio, avec nuancier, tablette graphique et carnet de croquis.",
  },
  {
    href: routes.guidePrixLogo,
    num: "02",
    kind: "Guide",
    title: "Combien coûte un logo en 2026 ?",
    text:
      "Quatre paliers de prix, le temps de travail réel et ce qui manque dans un devis à 200 €.",
    more: "Lire le guide",
    cover: "creer-un-logo",
    alt: "Graphiste dessinant un logo sur une tablette, devant un écran de création vectorielle.",
  },
  {
    href: routes.guidePrixSite,
    num: "03",
    kind: "Guide",
    title: "Combien coûte un site internet ?",
    text:
      "Les paliers du marché, les coûts récurrents que personne n'annonce et le prix réel d'un site vitrine.",
    more: "Lire le guide",
    cover: "site-internet",
    alt: "Ordinateur portable ouvert sur la page d'accueil d'un site, sur un bureau clair.",
  },
];

/** Trois pages pour préparer et vérifier. */
const PREPARER: Entree[] = [
  {
    href: routes.testerSonLogo,
    num: "04",
    kind: "Diagnostic",
    title: "Tester son logo et générer son favicon",
    text:
      "Votre logo à 16 px, en gris, en un seul ton, puis son favicon prêt à télécharger. Le fichier reste dans votre navigateur.",
    more: "Tester le logo",
    cover: "testeur-de-logo",
    alt: "Tablette et téléphone affichant un diagnostic de logo, sur un bureau.",
  },
  {
    href: routes.generateurBriefIdentite,
    num: "05",
    kind: "Outil",
    title: "Générateur de brief identité",
    text:
      "Dix questions pour écrire un brief propre, avec ce qui bloque un projet. Export en PDF.",
    more: "Rédiger un brief",
    cover: "brief-identite",
    alt: "Ordinateur portable affichant un formulaire de brief identité avec export PDF, sur un bureau.",
  },
  {
    href: routes.modeleCahierDesCharges,
    num: "06",
    kind: "Modèle",
    title: "Cahier des charges de site",
    text:
      "Douze blocs à remplir avant de demander un devis. DOCX et PDF, sans inscription.",
    more: "Télécharger le modèle",
    cover: "cahier-des-charges",
    alt: "Ordinateur portable affichant la couverture d'un cahier des charges de site internet, dans un bureau.",
  },
];

function Carte({ entree }: { entree: Entree }) {
  const base = `/assets/img/covers/${entree.cover}`;
  return (
    <Link href={entree.href} className={styles.card}>
      <span className={styles.cover}>
        <img
          src={`${base}-800.webp`}
          srcSet={`${base}-480.webp 480w, ${base}-800.webp 800w, ${base}-1200.webp 1200w`}
          sizes="(max-width: 640px) 92vw, (max-width: 980px) 46vw, 30vw"
          alt={entree.alt}
          width={1200}
          height={896}
          loading="lazy"
          decoding="async"
        />
      </span>
      <span className={styles.body}>
        <span className={styles.cardHead}>
          <span className={styles.num}>{entree.num}</span>
          <span className={styles.kind}>{entree.kind}</span>
        </span>
        <h3 className={styles.cardTitle}>{entree.title}</h3>
        <p className={styles.cardText}>{entree.text}</p>
        <span className={styles.cta}>
          {entree.more} <span aria-hidden="true">↗</span>
        </span>
      </span>
    </Link>
  );
}

export function RessourcesHub() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1>
              Six outils gratuits
              <br />
              pour <span style={{ color: "var(--accent)" }}>cadrer</span> votre projet
            </h1>
            <p className="intro">
              Ici, pas d&apos;articles de blog. Deux guides de prix, un calculateur de budget,
              un test de logo, un générateur de brief et un modèle de cahier des charges. Vous
              en sortez avec un budget situé et un document prêt à envoyer, avant même de
              demander un devis.
            </p>
          </div>
          <div className={styles.sousHead}>
            <p className={styles.pourQui}>
              Pour un dirigeant de TPE, un artisan ou une association qui doit lancer ou refaire
              son logo, son site ou son identité, et qui veut savoir où il met les pieds avant
              de signer.
            </p>
            <p className={styles.meta}>
              <span>6 pages</span>
              <span>Gratuit</span>
              <span>Sans inscription ni e-mail</span>
            </p>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <div className={styles.bloc}>
            <div className={styles.blocHead}>
              <h2 className={styles.blocTitle}>Situer le budget</h2>
              <p className={styles.blocText}>
                Trois pages pour savoir ce que coûte réellement ce que vous voulez faire, et
                pourquoi les prix affichés ailleurs ne veulent pas dire grand-chose.
              </p>
            </div>
            <div className={styles.grid}>
              {BUDGET.map((entree) => (
                <Carte key={entree.href} entree={entree} />
              ))}
            </div>
          </div>

          <div className={styles.bloc}>
            <div className={styles.blocHead}>
              <h2 className={styles.blocTitle}>Préparer et vérifier</h2>
              <p className={styles.blocText}>
                Trois pages pour tester ce que vous avez déjà et écrire ce que vous voulez,
                avec des documents que vous pouvez envoyer tels quels.
              </p>
            </div>
            <div className={styles.grid}>
              {PREPARER.map((entree) => (
                <Carte key={entree.href} entree={entree} />
              ))}
            </div>
          </div>

          <div className={styles.bloc}>
            <div className={styles.blocHead}>
              <h2 className={styles.blocTitle}>Comprendre ce qui vient</h2>
              <p className={styles.blocText}>
                Les outils servent à décider maintenant. Cette analyse sert à décider pour les
                deux prochaines années : ce qui change vraiment dans un site, et ce qui n'est
                qu'une mode.
              </p>
            </div>
            <Link href={routes.guideTendances2027} className={styles.wide}>
              <span className={styles.wideMedia}>
                <img
                  src="/assets/img/guides/tendances-2027-ouverture.webp"
                  alt="Visuel de couverture du guide : grand titre 2027 et maquette de navigateur illustrant une identité de marque."
                  width={1600}
                  height={900}
                  loading="lazy"
                  decoding="async"
                />
              </span>
              <span className={styles.wideBody}>
                <span className={styles.cardHead}>
                  <span className={styles.kind}>Analyse</span>
                  <span className={styles.num}>1 800 mots</span>
                </span>
                <h3 className={styles.wideTitle}>Tendances web design 2027</h3>
                <p className={styles.cardText}>
                  Quatre tendances passées au filtre du réel : ce qui change pour un site de PME,
                  de commerce ou d'indépendant, et ce qui ne tiendra pas deux ans.
                </p>
                <span className={styles.cta}>
                  Lire l&apos;analyse <span aria-hidden="true">↗</span>
                </span>
              </span>
            </Link>
          </div>

          <p className={styles.note}>
            Ces pages complètent les services du studio : elles servent à savoir où vous mettez
            les pieds avant de parler budget. Aucune ne demande votre e-mail, aucune ne renvoie
            vers un formulaire pour obtenir un chiffre. Si votre cas ne rentre dans aucune
            fourchette, écrivez-moi, le devis se construit sur votre périmètre.
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
