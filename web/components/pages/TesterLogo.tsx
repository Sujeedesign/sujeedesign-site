import Link from "next/link";
import Faq from "@/components/Faq";
import { LogoTester } from "@/components/LogoTester";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./TesterLogo.module.css";

export const pageMeta = {
  title: "Tester son logo : lisibilité et contraste",
  description:
    "Déposez votre logo, voyez-le à 16 px, en gris et en un ton. Cinq mesures, un verdict par critère, rien qui quitte votre navigateur.",
};

export const faqItems = [
  {
    question: "Mon fichier est-il envoyé sur un serveur ?",
    answer:
      "Non. L'image est lue par le navigateur et rendue localement. Aucun fichier n'est transmis, ni conservé, ni analysé par le studio. Vous pouvez couper votre connexion après le chargement : le test fonctionne encore.",
  },
  {
    question: "Quels formats sont acceptés ?",
    answer:
      "PNG, JPG, WebP et SVG jusqu'à 8 Mo. Pour un travail sérieux, partez du vectoriel : à l'écran un PNG suffit, en impression il ne suffit jamais.",
  },
  {
    question: "Pourquoi tester à 16 pixels ?",
    answer:
      "Seize pixels, c'est la taille d'un favicon et d'une icône d'application. Un logo qui devient une tache à cette taille perd son rôle de repère, même s'il est superbe en grand.",
  },
  {
    question: "Pourquoi le test en un seul ton ?",
    answer:
      "Parce qu'un logo finit toujours par être imprimé en noir, gravé, brodé ou tamponné. Si le dessin repose sur des écarts de couleur, ces usages le vident de son sens.",
  },
  {
    question: "Le verdict dit-il si mon logo est beau ?",
    answer:
      "Non, et c'est volontaire. La page mesure la lisibilité, le contraste et la tenue en un ton. Le jugement sur le style, la date et la pertinence par rapport à votre positionnement reste un travail humain.",
  },
  {
    question: "Que faire si le résultat est mauvais ?",
    answer:
      "Trois issues : faire redessiner les déclinaisons manquantes, moderniser le logo en gardant sa reconnaissance, ou repartir sur une identité. Les fourchettes correspondantes vont de 800 à 1 500 € pour une refonte, 650 à 900 € pour un logo simple.",
  },
];

const SOMMAIRE = [
  { href: "#outil", label: "L'outil" },
  { href: "#tests", label: "Les trois tests" },
  { href: "#mesures", label: "Les cinq mesures" },
  { href: "#limites", label: "Ce que ça ne dit pas" },
  { href: "#refonte", label: "Quand refaire" },
  { href: "#faq", label: "Questions fréquentes" },
];

export function TesterLogo() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1 className={styles.titre}>
              Votre logo
              <br />
              tient-il <span className={styles.accent}>vraiment</span> ?
            </h1>
            <p className="intro">
              Un logo se juge en situation, pas sur une planche de présentation. Déposez le
              fichier : il s&apos;affiche à 16 pixels, en gris, en un seul ton, sur fond clair et
              sur fond sombre. Rien ne quitte votre navigateur.
            </p>
          </div>
        </div>
      </header>

      <section className="section" id="outil">
        <div className="wrap">
          <div className={styles.conteneur}>
            <LogoTester />

            <div className={`legal ${styles.legalInner}`}>
              <nav className="toc" aria-label="Sommaire de la page">
                {SOMMAIRE.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="prose">
                <h2 id="tests">Les trois tests qui comptent</h2>
                <p>
                  Un logo doit survivre à trois situations qu&apos;on oublie au moment de le
                  choisir. Elles arrivent toutes les trois, souvent la première année.
                </p>
                <ul>
                  <li>
                    <strong>La taille minuscule.</strong> Favicon, icône d&apos;application, photo
                    de profil, pastille de navigation. Seize pixels ne pardonnent rien : les
                    détails fins se transforment en bouillie.
                  </li>
                  <li>
                    <strong>Le un ton.</strong> Tampon, gravure, broderie, fax administratif,
                    impression économique. Si la reconnaissance dépend de la couleur, le logo
                    disparaît dans ces usages.
                  </li>
                  <li>
                    <strong>Le fond imprévu.</strong> Une photo sombre, un mur, un carton brut. Un
                    logo qui n&apos;existe qu&apos;en version foncée sur blanc finit collé dans un
                    rectangle visible.
                  </li>
                </ul>

                <h2 id="mesures">Les cinq mesures affichées</h2>
                <p>
                  La page ne donne pas de note globale, elle mesure cinq points et laisse le
                  jugement esthétique de côté.
                </p>
                <ul>
                  <li>
                    <strong>Résolution.</strong> La largeur réelle du fichier. En dessous de 300
                    pixels, l&apos;agrandissement devient flou ; un SVG échappe au problème.
                  </li>
                  <li>
                    <strong>Transparence.</strong> Un fond opaque oblige à découper le logo à
                    chaque usage. C&apos;est la première chose qu&apos;un studio redemande.
                  </li>
                  <li>
                    <strong>Contraste sur fond clair.</strong> Rapport calculé entre la partie la
                    plus sombre du logo et le papier. En dessous de 3 pour 1, une zone du logo
                    s&apos;efface.
                  </li>
                  <li>
                    <strong>Contraste sur fond sombre.</strong> Même calcul face à un fond encre.
                    C&apos;est ce qui décide de la nécessité d&apos;une version claire.
                  </li>
                  <li>
                    <strong>Détails en un seul ton.</strong> Part de la surface dont la lecture
                    dépend d&apos;un écart de couleur. Au-delà d&apos;un quart, le logo perd son
                    sens en noir et blanc.
                  </li>
                </ul>

                <h2 id="limites">Ce que ce test ne dit pas</h2>
                <p>
                  Il ne dira jamais si votre logo est daté, banal, ou à côté de votre
                  positionnement. Ce sont les trois raisons les plus fréquentes de refaire une
                  identité, et aucune ne se mesure en pixels.
                </p>
                <p>
                  Il ne dit rien non plus sur l&apos;antériorité : un logo peut être lisible et
                  déjà déposé par quelqu&apos;un d&apos;autre. Cette vérification se fait à
                  l&apos;INPI, séparément.
                </p>

                <h2 id="refonte">Quand envisager une refonte</h2>
                <p>
                  Si deux mesures ou plus sont bloquantes, la question n&apos;est plus
                  esthétique : votre logo vous coûte du temps à chaque support. Une refonte garde
                  ce qui est reconnaissable et corrige le reste, sans repartir de zéro.
                </p>
                <p>
                  Pour situer le budget, la refonte de logo se situe entre{" "}
                  <strong>800 et 1 500 €</strong> selon l&apos;état des fichiers et le nombre de
                  déclinaisons. Une création complète démarre à 650 € pour un logo simple. Le{" "}
                  <Link href={routes.guidePrixLogo}>guide des prix</Link> détaille chaque palier,
                  et le <Link href={routes.calculateurBudgetIdentite}>calculateur</Link> ajoute les
                  options.
                </p>

                <Faq items={faqItems} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="wrap">
          <div className="bandcta bandcta--dark cta-glow">
            <div className="glow" aria-hidden="true" />
            <div className={styles.ctaCopy}>
              <p>Le verdict est mitigé ?</p>
              <p className={styles.ctaText}>
                Envoyez le fichier et l&apos;usage principal. On vous dit ce qui peut être corrigé
                sans tout redessiner, et ce que ça implique en budget.
              </p>
            </div>
            <div className={styles.ctaLinks}>
              <Link className="btn-fill btn-fill--light" href={routes.contact}>
                Demander un avis <span aria-hidden="true">↗</span>
              </Link>
              <Link className="btn-line btn-line--light" href={serviceHref("identite-de-marque")}>
                Voir la refonte de logo
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
