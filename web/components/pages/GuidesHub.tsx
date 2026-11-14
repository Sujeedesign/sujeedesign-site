import Link from "next/link";
import { routes } from "@/lib/routes";
import styles from "./RessourcesHub.module.css";
import vtc from "./GuidesHub.module.css";

export const pageMeta = {
  title: "Guides : prix et choix pour lancer un projet",
  description:
    "Quatre guides pour décider sans se tromper : prix d'un logo, prix d'un site, agence ou freelance, tendances 2027. Chiffres réels et temps de travail.",
};

type Entree = {
  href: string;
  num: string;
  kind: string;
  title: string;
  text: string;
  more: string;
  cover: string;
  alt: string;
};

/** Trois guides pour situer un budget et choisir à qui le confier. */
const DECIDER: Entree[] = [
  {
    href: routes.guidePrixLogo,
    num: "01",
    kind: "Guide",
    title: "Combien coûte un logo en 2026 ?",
    text:
      "Quatre paliers de prix, le temps de travail réel derrière chaque niveau, et ce qui manque dans un devis à 200 €.",
    more: "Lire le guide",
    cover: "creer-un-logo",
    alt: "Graphiste dessinant un logo sur une tablette, devant un écran de création vectorielle.",
  },
  {
    href: routes.guidePrixSite,
    num: "02",
    kind: "Guide",
    title: "Combien coûte un site internet ?",
    text:
      "Les fourchettes du marché, les coûts récurrents que personne n'annonce et le prix réel d'un site vitrine.",
    more: "Lire le guide",
    cover: "site-internet",
    alt: "Ordinateur portable ouvert sur la page d'accueil d'un site, sur un bureau clair.",
  },
  {
    href: routes.guideAgenceFreelance,
    num: "03",
    kind: "Décision",
    title: "Agence ou freelance, comment choisir",
    text:
      "Ce qui change vraiment entre les deux, les signaux qui doivent alerter, et la question à poser avant de signer.",
    more: "Lire le guide",
    cover: "freelance-ou-agence",
    alt: "Équipe de designers travaillant ensemble autour d'une table blanche dans un studio lumineux.",
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

export function GuidesHub() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Guides</p>
            <h1>
              Décider avant
              <br />
              de <span style={{ color: "var(--accent)" }}>signer</span>
            </h1>
            <p className="intro">
              Quatre guides écrits à partir de projets réels : ce que coûte une identité ou un
              site, comment choisir entre une agence et un indépendant, et ce qui va vraiment
              changer dans le web d&apos;ici 2027. Pas de promesse, des chiffres et du temps de
              travail.
            </p>
          </div>
          <div className={styles.sousHead}>
            <p className={styles.pourQui}>
              Pour un dirigeant de TPE, un artisan ou une association qui doit engager un budget
              et veut comprendre ce qu&apos;il achète avant de demander un devis.
            </p>
            <p className={styles.meta}>
              <span>4 guides</span>
              <span>Gratuit</span>
              <span>Sans inscription</span>
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
                Deux guides de prix et une grille de lecture pour choisir à qui confier le
                projet, avec le temps de travail réel derrière chaque fourchette.
              </p>
            </div>
            <div className={styles.grid}>
              {DECIDER.map((entree) => (
                <Carte key={entree.href} entree={entree} />
              ))}
            </div>
          </div>

          <div className={styles.bloc}>
            <div className={styles.blocHead}>
              <h2 className={styles.blocTitle}>Comprendre ce qui vient</h2>
              <p className={styles.blocText}>
                Les guides servent à décider maintenant. Cette analyse sert à décider pour les
                deux prochaines années : ce qui change vraiment dans un site, et ce qui n&apos;est
                qu&apos;une mode.
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
                  de commerce ou d&apos;indépendant, et ce qui ne tiendra pas deux ans.
                </p>
                <span className={styles.cta}>
                  Lire l&apos;analyse <span aria-hidden="true">↗</span>
                </span>
              </span>
            </Link>
          </div>

          <div className={vtc.vtc}>
            <span className={vtc.vtcMedia}>
              <img
                src="/assets/vtc/chauffeur-mercedes-900.webp"
                alt="Chauffeur VTC en costume devant sa berline, photo d'ouverture du guide."
                width={900}
                height={600}
                loading="lazy"
                decoding="async"
              />
            </span>
            <div className={vtc.vtcBody}>
              <p className={vtc.vtcKick}>Hors design · chauffeurs VTC</p>
              <h2 className={vtc.vtcTitle}>
                Réussir l&apos;examen VTC 2027, seul
              </h2>
              <p className={vtc.vtcText}>
                Les 7 épreuves décryptées, les 3 seuils, un plan de 45 jours et 7 fiches mémo
                gratuites. Pour les chauffeurs déjà en activité, un pack site et flyer
                clé en main : 490 € de mise en service, puis 39 €/mois.
              </p>
              <ul className={vtc.vtcPoints}>
                <li>85 pages</li>
                <li>7 fiches offertes</li>
                <li>Plan 45 jours</li>
              </ul>
              <div className={vtc.vtcFoot}>
                <Link href={routes.vtc} className={vtc.vtcCta}>
                  Ouvrir le guide VTC <span aria-hidden="true">↗</span>
                </Link>
                <span className={vtc.vtcPrice}>
                  Guide <b>19,90 €</b> · pack site <b>490 € + 39 €/mois</b>
                </span>
              </div>
            </div>
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
