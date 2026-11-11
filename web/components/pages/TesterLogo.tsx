import Link from "next/link";
import Faq from "@/components/Faq";
import { LogoTester } from "@/components/LogoTester";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./TesterLogo.module.css";
import { CoverFigure } from "./CoverFigure";

export const pageMeta = {
  title: "Générateur de favicon gratuit et test de logo",
  description:
    "Transformez votre logo en favicon prêt à installer : .ico, PNG de 16 à 512 px, apple-touch et manifest, dans un zip. Gratuit, sans envoi de fichier.",
};

export const faqItems = [
  {
    question: "Comment créer un favicon à partir de mon logo ?",
    answer:
      "Déposez le fichier, recadrez le carré qui restera lisible à seize pixels, vérifiez le rendu dans l'onglet, puis téléchargez le zip. Il contient favicon.ico, les PNG 16, 32 et 48 px, l'apple-touch-icon en 180 px, les icônes Android 192 et 512 px et le site.webmanifest. Il ne reste qu'à déposer ces fichiers à la racine du site et à les déclarer dans l'en-tête des pages.",
  },
  {
    question: "Le générateur de favicon est-il gratuit ?",
    answer:
      "Oui, sans compte, sans email et sans version payante. Le logo est décodé et les fichiers sont encodés par le navigateur : rien n'est téléversé, il n'y a donc ni stockage ni quota à financer. Vous pouvez retélécharger le pack autant de fois que nécessaire.",
  },
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
      "Trois issues : faire redessiner les déclinaisons manquantes, moderniser le logo en gardant sa reconnaissance, ou repartir sur une identité. Comptez 800 € pour un logo seul, 1 100 € avec ses déclinaisons et 3 500 € pour un rebranding complet.",
  },
];

const SOMMAIRE = [
  { href: "#outil", label: "L'outil" },
  { href: "#favicon", label: "Générateur de favicon" },
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
              Votre logo{" "}
              <br />
              tient-il <span className={styles.accent}>vraiment</span> ?
            </h1>
            <p className="intro">
              Un logo se juge en situation, pas sur une planche de présentation. Déposez le
              fichier : il s&apos;affiche à 16 pixels, en gris, en un seul ton, sur fond clair et
              sur fond sombre. L&apos;outil en tire ensuite le pack favicon complet, prêt à
              installer. Rien ne quitte votre navigateur.
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
                <CoverFigure
                  slug="testeur-de-logo"
                  alt="Tablette et téléphone affichant un diagnostic de logo, sur un bureau."
                  caption="Un logo doit tenir à 16 pixels, en une seule couleur et en favicon. Le test se fait dans le navigateur, sans envoyer de fichier."
                />
                <h2 id="favicon">Générateur de favicon : le pack complet depuis votre logo</h2>
                <p>
                  La page fait deux choses. Elle mesure la tenue du logo, puis elle en fait une
                  icône : recadrage carré, aperçu dans un onglet de navigateur, et génération du
                  pack de favicons attendu par les navigateurs, iOS et Android. Le calcul se fait
                  dans votre navigateur, sans compte, et le zip est prêt en quelques secondes.
                </p>

                <h3>Ce que contient le zip</h3>
                <ul>
                  <li>
                    <strong>favicon.ico</strong>, avec les trois tailles historiques de 16, 32 et
                    48 pixels dans un seul fichier, pour les navigateurs et les raccourcis qui le
                    réclament encore.
                  </li>
                  <li>
                    <strong>favicon-16x16.png, 32x32 et 48x48</strong>, les tailles lues par les
                    onglets, les favoris et la barre des tâches.
                  </li>
                  <li>
                    <strong>apple-touch-icon.png</strong> en 180 pixels, l&apos;icône ajoutée à
                    l&apos;écran d&apos;accueil d&apos;un iPhone ou d&apos;un iPad.
                  </li>
                  <li>
                    <strong>android-chrome-192x192.png et 512x512.png</strong>, les icônes
                    d&apos;application Android et du manifeste.
                  </li>
                  <li>
                    <strong>site.webmanifest</strong>, le fichier qui déclare le nom, les icônes
                    et la couleur de thème du site.
                  </li>
                </ul>

                <h3>Comment créer un favicon à partir de son logo</h3>
                <ol>
                  <li>
                    Déposez le logo en PNG ou en SVG, 512 pixels de large au minimum. En dessous,
                    les grandes tailles seront floues.
                  </li>
                  <li>
                    Recadrez le carré. Un favicon n&apos;est pas le logo entier réduit : c&apos;est
                    la partie du dessin qui reste identifiable à 16 pixels.
                  </li>
                  <li>
                    Regardez le résultat dans l&apos;onglet, sur fond clair puis sur fond sombre.
                    C&apos;est là que se voient les traits trop fins et les contrastes trop faibles.
                  </li>
                  <li>
                    Téléchargez le zip, déposez les fichiers à la racine du site et déclarez-les
                    dans l&apos;en-tête des pages. Videz le cache du navigateur pour voir la
                    nouvelle icône.
                  </li>
                </ol>

                <p>
                  Une icône réussie tient en trois qualités : un dessin simplifié, un fond
                  transparent ou plein, et un contraste franc avec l&apos;onglet clair comme avec
                  l&apos;onglet sombre. Si le logo ne passe pas ce filtre, aucune taille de fichier
                  ne le sauvera : c&apos;est le dessin qu&apos;il faut reprendre.
                </p>

                <p>
                  Pour les couleurs de la marque elle-même, le{" "}
                  <Link href={routes.testContraste}>test de contraste WCAG</Link> donne le rapport
                  exact et propose un ton conforme sans changer la teinte.
                </p>

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
                  Pour situer le budget, une création de logo démarre à{" "}
                  <strong>800 €</strong>, un logo décliné coûte 1 100 €, et un rebranding complet
                  se situe à 3 500 €. Le{" "}
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
