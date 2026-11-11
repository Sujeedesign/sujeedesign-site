/**
 * Page /ressources/test-contraste-couleur.
 *
 * Le contenu éditorial est rendu par le serveur : les seuils, les erreurs
 * courantes et la FAQ sont lisibles sans JavaScript. Seul le vérificateur est
 * un îlot client.
 */
import Link from "next/link";
import Faq from "@/components/Faq";
import { ContrastChecker } from "@/components/ContrastChecker";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./TestContraste.module.css";

export const pageMeta = {
  title: "Test de contraste couleurs WCAG AA et AAA",
  description:
    "Testez le contraste entre deux couleurs : seuils WCAG AA et AAA, simulation de daltonisme, correctif qui garde la teinte. Gratuit, sans inscription.",
};

const SOMMAIRE = [
  { href: "#outil", label: "Le vérificateur" },
  { href: "#seuils", label: "Les seuils" },
  { href: "#pourquoi", label: "Pourquoi 4,5:1" },
  { href: "#erreurs", label: "Les erreurs courantes" },
  { href: "#methode", label: "Comment l'utiliser" },
  { href: "#faq", label: "Questions fréquentes" },
];

export const faqItems = [
  {
    question: "Quel rapport de contraste faut-il atteindre ?",
    answer:
      "4,5:1 pour du texte courant et 3:1 pour le grand texte, c'est le niveau AA du WCAG 2.2, celui que visent la plupart des sites publics et des appels d'offres. Le niveau AAA monte à 7:1 et 4,5:1. En dessous de 3:1, un texte n'est plus lisible pour une partie des visiteurs.",
  },
  {
    question: "Le contraste s'applique-t-il aussi aux boutons et aux icônes ?",
    answer:
      "Oui, mais les seuils diffèrent. Un composant d'interface, bordure de champ ou icône porteuse de sens demande 3:1 contre ce qui l'entoure. Le texte dans un bouton reste soumis à 4,5:1. Un logo, lui, est exempté : c'est une image de marque, pas du texte.",
  },
  {
    question: "Pourquoi mon gris semble-t-il correct à l'écran et échoue au test ?",
    answer:
      "Parce qu'un écran bien réglé, en intérieur, pardonne beaucoup. Le calcul ne pardonne rien : il compare les luminances réelles. Un gris #767676 sur blanc passe tout juste à 4,54:1 ; un gris #808080 tombe à 3,95:1 et échoue, alors qu'il paraît presque identique à l'œil.",
  },
  {
    question: "Le simulateur de daltonisme est-il une mesure médicale ?",
    answer:
      "Non. C'est une approximation d'affichage, utile pour repérer une paire de couleurs qui s'effondre quand les teintes se rapprochent. Environ 8 % des hommes européens ont une déficience de la vision des couleurs, la plus fréquente étant la deutéranopie.",
  },
  {
    question: "Mes couleurs sont-elles envoyées quelque part ?",
    answer:
      "Non. Le calcul se fait dans votre navigateur, aucune valeur n'est transmise à un serveur. Il n'y a ni compte, ni quota, ni historique conservé.",
  },
  {
    question: "Et si je dois changer ma charte graphique pour passer le test ?",
    answer:
      "Ce n'est presque jamais nécessaire. Dans la majorité des cas, on garde la teinte et on fonce ou on éclaircit le ton de quelques pour cent. Le bouton de correction proposé plus haut fait exactement ça.",
  },
];

export function TestContraste() {
  return (
    <div>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1 className={styles.titre}>
              Deux couleurs,
              <br />
              un <span className={styles.accent}>rapport de contraste</span>
            </h1>
            <p className="intro">
              Un texte lisible en grand peut devenir illisible en petit. Cet outil compare deux
              couleurs avec la formule du WCAG 2.2, affiche les quatre seuils, simule la vision de
              trois formes de daltonisme et propose un correctif qui garde votre teinte. Tout se
              calcule dans votre navigateur.
            </p>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <div className={styles.conteneur}>
            <div className={`legal ${styles.legalInner}`}>
              <nav className="toc" aria-label="Sommaire de la page">
                {SOMMAIRE.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="prose">
                <div id="outil">
                  <h2>Le vérificateur</h2>
                  <p>
                    Entrez la couleur du texte et celle du fond, en hexadécimal ou au sélecteur. Le
                    rapport s&apos;affiche immédiatement, avec les quatre seuils et un aperçu aux trois
                    tailles qui comptent : 30, 18 et 16 pixels.
                  </p>
                  <ContrastChecker />
                </div>

                <h2 id="seuils">Les seuils à connaître</h2>
                <p>
                  Le WCAG définit deux niveaux utiles au quotidien. AA est le niveau exigé par la
                  plupart des référentiels publics, AAA le niveau confortable. Les valeurs dépendent de
                  la taille du texte, parce qu&apos;un caractère plus grand se lit avec moins de
                  contraste.
                </p>

                <div className="tableWrap">
                  <table>
                    <caption>Seuils de contraste du WCAG 2.2, rapport entre la couleur la plus claire et la plus sombre.</caption>
                    <thead>
                      <tr>
                        <th scope="col">Usage</th>
                        <th scope="col">Niveau AA</th>
                        <th scope="col">Niveau AAA</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <th scope="row">Texte courant, moins de 24 px</th>
                        <td className={styles.price} data-label="AA">4,5:1</td>
                        <td className={styles.price} data-label="AAA">7:1</td>
                      </tr>
                      <tr>
                        <th scope="row">Grand texte, 24 px ou gras 18,66 px</th>
                        <td className={styles.price} data-label="AA">3:1</td>
                        <td className={styles.price} data-label="AAA">4,5:1</td>
                      </tr>
                      <tr>
                        <th scope="row">Composant d&apos;interface, bordure, icône</th>
                        <td className={styles.price} data-label="AA">3:1</td>
                        <td className={styles.price} data-label="AAA">non défini</td>
                      </tr>
                      <tr>
                        <th scope="row">Logo et logotype</th>
                        <td className={styles.price} data-label="AA">exempté</td>
                        <td className={styles.price} data-label="AAA">exempté</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h2 id="pourquoi">Pourquoi 4,5:1 et pas un chiffre au hasard</h2>
                <p>
                  Le rapport de contraste compare la luminance relative des deux couleurs, pondérée
                  selon la sensibilité de l&apos;œil : 0,2126 pour le rouge, 0,7152 pour le vert, 0,0722
                  pour le bleu. Deux couleurs de même clarté perçue donnent un rapport proche de 1:1,
                  donc illisible. Le blanc sur noir monte à 21:1, le maximum possible.
                </p>
                <p>
                  Le seuil de 4,5:1 vient des travaux de normalisation sur la lisibilité : il
                  correspond au point où un texte de taille courante reste déchiffrable par une
                  personne ayant une acuité visuelle réduite, sur un écran de qualité moyenne, dans
                  une pièce éclairée normalement. Ce n&apos;est pas une garantie de confort, c&apos;est un
                  plancher.
                </p>

                <h2 id="erreurs">Les trois erreurs qui coûtent le plus</h2>
                <p>
                  <strong>Le gris du texte secondaire.</strong> C&apos;est la faute la plus fréquente :
                  un gris clair pour hiérarchiser, qui passe sur grand écran et disparaît sur
                  téléphone. Sur fond blanc, le dernier gris acceptable est autour de #767676.
                </p>
                <p>
                  <strong>Le texte sur photo.</strong> Un texte posé directement sur une image n&apos;a
                  pas de couleur de fond stable : selon la zone, le contraste varie du simple au
                  triple. La solution tient en un voile sombre, une plaque, ou un dégradé local.
                </p>
                <p>
                  <strong>Le bouton corail sur fond blanc.</strong> Une couleur de marque vive passe
                  souvent sous 4,5:1. On garde la teinte, on fonce le ton pour le texte du bouton, ou
                  on remplit le bouton avec la couleur et on écrit en blanc par-dessus, en vérifiant
                  que ce blanc tienne.
                </p>

                <h2 id="methode">Comment l&apos;utiliser</h2>
                <ol>
                  <li>Relevez les deux codes hexadécimaux réels, pas une approximation à l&apos;œil.</li>
                  <li>Testez la paire principale, puis les paires secondaires : légendes, placeholders, liens.</li>
                  <li>Passez en simulation de daltonisme : si le rapport s&apos;effondre, la couleur seule ne porte pas l&apos;information.</li>
                  <li>Corrigez avec le ton proposé, ou changez la taille du texte si le seuil visé est AAA.</li>
                  <li>Notez les valeurs retenues dans votre charte, pour ne pas les réinventer à chaque support.</li>
                </ol>
                <p>
                  Pour une vérification complète d&apos;un site, le contraste ne suffit pas : il faut
                  aussi la taille des zones cliquables, les textes alternatifs et la navigation au
                  clavier. Le référentiel RGAA détaille ces critères, et le test de logo du studio
                  vérifie la tenue d&apos;une marque à seize pixels.
                </p>

                <Faq items={faqItems} />

                <p>
                  Un doute sur votre charte actuelle ? Le{" "}
                  <Link href={routes.testerSonLogo}>test de logo</Link> vérifie la lisibilité à 16
                  pixels, et la page{" "}
                  <Link href={serviceHref("identite-de-marque")}>identité de marque</Link> détaille ce
                  qui est livré, contrastes et déclinaisons compris.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
