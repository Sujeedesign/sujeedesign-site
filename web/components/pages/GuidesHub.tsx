import Link from "next/link";
import { routes } from "@/lib/routes";
import styles from "./GuidesHub.module.css";

export const pageMeta = {
  title: "Guides : prix, choix et méthode avant de lancer un projet",
  description:
    "Quatre guides pour décider sans se tromper : prix d'un logo, prix d'un site, agence ou freelance, tendances 2027. Chiffres réels et temps de travail.",
};

type Guide = {
  href: string;
  num: string;
  kind: string;
  title: string;
  text: string;
  meta: string;
};

const GUIDES: Guide[] = [
  {
    href: routes.guidePrixLogo,
    num: "01",
    kind: "Prix",
    title: "Combien coûte un logo en 2026 ?",
    text:
      "Quatre paliers de prix, le temps de travail réel derrière chaque niveau, et ce qui manque dans un devis à 200 €.",
    meta: "9 min",
  },
  {
    href: routes.guidePrixSite,
    num: "02",
    kind: "Prix",
    title: "Combien coûte un site internet ?",
    text:
      "Les fourchettes du marché, les coûts récurrents que personne n'annonce et le prix réel d'un site vitrine.",
    meta: "11 min",
  },
  {
    href: routes.guideAgenceFreelance,
    num: "03",
    kind: "Décision",
    title: "Agence ou freelance, comment choisir",
    text:
      "Ce qui change vraiment entre les deux, les signaux qui doivent alerter, et la question à poser avant de signer.",
    meta: "8 min",
  },
  {
    href: routes.guideTendances2027,
    num: "04",
    kind: "Analyse",
    title: "Tendances web design 2027",
    text:
      "Quatre tendances passées au filtre du réel : ce qui tient deux ans pour une PME, et ce qui n'est qu'une mode.",
    meta: "12 min",
  },
];

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
          <div className={styles.bar}>
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
          <div className={styles.grid}>
            {GUIDES.map((guide) => (
              <Link key={guide.href} href={guide.href} className={styles.card}>
                <span className={styles.cardTop}>
                  <span className={styles.num}>{guide.num}</span>
                  <span className={styles.kind}>{guide.kind}</span>
                </span>
                <h2 className={styles.cardTitle}>{guide.title}</h2>
                <p className={styles.cardText}>{guide.text}</p>
                <span className={styles.cardFoot}>
                  <span className={styles.read}>
                    Lire le guide <span aria-hidden="true">↗</span>
                  </span>
                  <span className={styles.time}>{guide.meta}</span>
                </span>
              </Link>
            ))}
          </div>

          <div className={styles.vtc}>
            <div className={styles.vtcMedia}>
              <img
                src="/assets/vtc/chauffeur-mercedes-900.webp"
                alt="Chauffeur VTC en costume au volant de sa berline."
                width={900}
                height={600}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className={styles.vtcBody}>
              <p className={styles.vtcKick}>Hors design · chauffeurs VTC</p>
              <h2 className={styles.vtcTitle}>
                Réussir l&apos;examen VTC 2027, seul
              </h2>
              <p className={styles.vtcText}>
                Un guide de 85 pages sur les 7 épreuves, les 3 seuils et un plan de 45 jours,
                avec 7 fiches mémo gratuites. Et pour ceux qui sont déjà en activité, un pack
                site, logo et flyer clé en main.
              </p>
              <Link href={routes.vtc} className={styles.vtcCta}>
                Ouvrir le guide VTC
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
