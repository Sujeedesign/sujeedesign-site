import Link from "next/link";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./GuideTendances2027.module.css";

export const pageMeta = {
  title: "Tendances web design 2027 : ce qui change vraiment",
  description:
    "Onze tendances web design 2027 passées au filtre du réel : ce qui change pour votre site, ce que ça coûte, et ce qu'il vaut mieux ignorer.",
};

export const faqItems = [
  {
    question: "Faut-il refaire son site en 2027 ?",
    answer:
      "Non, pas par principe. Un site lisible, rapide et à jour sur le fond vaut mieux qu'un site refait pour suivre une mode. Refaites-le si le vôtre ne convertit plus, s'il est lent sur mobile ou si votre offre a changé.",
  },
  {
    question: "Le glassmorphism est-il accessible ?",
    answer:
      "Il peut l'être, à condition de garder un contraste suffisant entre le texte et le fond, de ne pas empiler plusieurs couches translucides et de prévoir une version sans flou pour les appareils qui le supportent mal.",
  },
  {
    question: "Combien coûte l'adaptation d'un site aux tendances 2027 ?",
    answer:
      "Cela dépend du point de départ. Une remise à niveau typographique, couleur et performance se chiffre en jours. Une refonte complète avec design system se chiffre en semaines. Le devis doit distinguer les deux.",
  },
  {
    question: "Les contenus aidés par l'IA sont-ils pénalisés par Google ?",
    answer:
      "Pas en tant que tels. Google évalue l'utilité et la fiabilité d'une page, pas la méthode de production. Un texte généré sans vérification, sans exemple et sans relecture se classe mal parce qu'il n'apporte rien, pas parce qu'il est généré.",
  },
];

const SOMMAIRE = [
  { href: "#minimalisme", label: "La fin du beige" },
  { href: "#personnalisation", label: "Personnalisation" },
  { href: "#ia", label: "L’IA dans le processus" },
  { href: "#motion", label: "Le motion utile" },
  { href: "#design-system", label: "Design systems" },
  { href: "#accessibilite", label: "Accessibilité" },
  { href: "#performance", label: "Performance" },
  { href: "#imperfection", label: "Imperfection" },
  { href: "#culture", label: "Références culturelles" },
  { href: "#glassmorphism", label: "Glassmorphism" },
  { href: "#couleurs", label: "Couleurs franches" },
  { href: "#ignorer", label: "Ce qu’on ignore" },
  { href: "#decider", label: "Comment décider" },
  { href: "#garder", label: "Ce qu’on garde" },
  { href: "#faq", label: "Questions" },
];

function Figure({
  src,
  width,
  height,
  alt,
  caption,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}) {
  return (
    <figure className={styles.figure}>
      <img
        src={src}
        width={width}
        height={height}
        alt={alt}
        loading="lazy"
        decoding="async"
      />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function GuideTendances2027() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Guides</p>
            <h1 className={styles.titre}>
              Tendances web design
              <br />
              <span className={styles.accent}>2027</span> : ce qui va
              <br />
              vraiment changer.
            </h1>
            <p className="intro">
              Onze tendances passées au filtre du réel. Ce qui change pour votre site, ce que
              ça coûte, et ce qu&apos;il vaut mieux ignorer.
            </p>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <div className={styles.conteneur}>
            <div className={`legal ${styles.legalInner}`}>
              <nav className="toc" aria-label="Sommaire de la page">
                <p className={styles.tocLabel}>Sommaire</p>
                {SOMMAIRE.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="prose">
                <p className={styles.lead}>
                  Chaque année, la même liste revient. Interfaces liquides, couleurs
                  impossibles, animations partout. On trouve ça beau, on oublie, et on
                  retourne sur son site qui date de trois ans.
                </p>
                <p>
                  Les tendances ne sont pas un programme à appliquer. Ce sont des signaux :
                  ce que les visiteurs trouvent désormais normal, ce que les concurrents
                  testent, ce qui deviendra un standard dans un an.
                </p>
                <p>
                  J&apos;ai pris la liste 2027 du studio Kirki, dix tendances, et je l&apos;ai
                  passée au filtre qui compte pour une PME, un commerce ou un indépendant.
                  Pour chacune : ce que c&apos;est, ce que ça change sur votre site, et ce
                  qu&apos;il ne faut pas faire. À la fin, la section que personne n&apos;écrit :
                  ce qu&apos;on ignore volontairement.
                </p>

                <Figure
                  src="/assets/img/guides/tendances-2027-ouverture.webp"
                  width={1600}
                  height={900}
                  alt="Composition graphique noire et rouge : le nombre 2027 et une maquette de page d'accueil."
                  caption="Le guide 2027 : une liste de tendances, ramenée à ce qu'un site doit vraiment faire."
                />

                <h2 id="minimalisme">1. Le minimalisme beige a fait son temps</h2>
                <p>
                  On a vécu dix ans de sites blancs, gris clair, typographie fine et photos
                  d&apos;équipe souriante. Ce style a eu une vertu : il a nettoyé le web des
                  fonds étoilés et des menus à onze entrées. Il a aussi produit une mer
                  d&apos;interfaces interchangeables.
                </p>
                <p>
                  Le mouvement 2027 ne consiste pas à revenir au décoratif. Il consiste à
                  réintroduire de la matière, de la couleur et de la personnalité dans un
                  cadre qui reste lisible. Une texture de papier, un rouge franc, une
                  typographie avec du caractère, une photo qui n&apos;a pas l&apos;air
                  d&apos;avoir été achetée au même endroit que celle du voisin.
                </p>
                <p>
                  Pour votre site, la question n&apos;est pas « quel style est à la mode ».
                  C&apos;est : « est-ce qu&apos;on me reconnaît si j&apos;enlève mon logo ? »
                  Si la réponse est non, le problème n&apos;est pas la tendance, c&apos;est{" "}
                  <Link href={serviceHref("identite-de-marque")}>
                    l&apos;identité de marque
                  </Link>
                  .
                </p>
                <p>
                  À éviter : empiler des effets pour masquer une marque faible. Un site beige
                  sans idée reste un site sans idée, même avec du grain.
                </p>

                <h2 id="personnalisation">2. La personnalisation en temps réel</h2>
                <p>
                  Les interfaces commencent à s&apos;adapter au visiteur : contenu mis en
                  avant selon la page d&apos;où il vient, selon son historique, selon le
                  moment de la journée, selon qu&apos;il est déjà client ou non.
                </p>
                <p>
                  Concrètement, c&apos;est souvent simple. Un visiteur qui arrive depuis un
                  guide sur les prix voit d&apos;abord votre offre d&apos;audit. Un client
                  existant ne voit plus le bandeau « premier rendez-vous gratuit ». Une
                  boutique met en avant la catégorie consultée la dernière fois.
                </p>

                <Figure
                  src="/assets/img/guides/tendances-2027-variantes.webp"
                  width={1600}
                  height={1000}
                  alt="Trois écrans côte à côte montrant la même page adaptée à un prospect, à un client et à un visiteur venu des réalisations."
                  caption="Personnalisation contextuelle : la même page, trois contenus prioritaires selon la provenance du visiteur."
                />

                <p>
                  Deux limites. Côté technique, cela demande de la donnée, donc du
                  consentement et du développement. Côté éditorial, mal fait, cela devient
                  intrusif : un site qui change de visage inquiète plus qu&apos;il ne rassure.
                </p>
                <p>
                  La version raisonnable pour une PME : de la personnalisation contextuelle,
                  sans traceur, basée sur la page d&apos;entrée ou le canal d&apos;acquisition.
                  On reste dans le RGPD par construction.
                </p>

                <h2 id="ia">3. L&apos;IA entre dans le processus, pas seulement dans le rendu</h2>
                <p>
                  En 2026, l&apos;IA servait surtout à produire une image ou un texte. En
                  2027, elle s&apos;installe plus tôt : recherche d&apos;idées, variantes de
                  mise en page, tests de hiérarchie, génération de composants, contrôle de
                  contraste, rédaction de premières versions.
                </p>
                <p>
                  C&apos;est une bonne nouvelle pour les petites structures, à une condition :
                  garder la décision. Une IA propose, un humain choisit. Le risque n&apos;est
                  pas de produire avec l&apos;IA, c&apos;est de publier sans relire.
                </p>
                <p>
                  Côté référencement, Google ne pénalise pas un contenu parce qu&apos;il a été
                  aidé par une machine. Il évalue s&apos;il répond à une intention, s&apos;il
                  est fiable, s&apos;il apporte une information qu&apos;on ne trouve pas
                  partout. Un article enrichi de votre expérience et de vos chiffres peut se
                  classer. Le même article sans relecture, non.
                </p>
                <p>
                  À éviter : automatiser la relation client. Un chatbot qui répond « je vous
                  invite à nous contacter » à une question de prix ne fait pas gagner du
                  temps, il fait perdre un prospect.
                </p>

                <h2 id="motion">4. Le motion informe au lieu de décorer</h2>
                <p>
                  Une animation utile répond à une question : où suis-je, que vient-il de se
                  passer, que puis-je faire. Un bouton qui se remplit au clic, un panier qui
                  confirme sans recharger la page, une carte qui s&apos;ouvre sans faire sauter
                  la mise en page.
                </p>
                <p>
                  L&apos;animation décorative coûte cher : elle alourdit le chargement, fatigue
                  l&apos;œil et peut gêner les personnes sensibles au mouvement. Les systèmes
                  proposent un réglage pour réduire les animations. Votre site doit le
                  respecter avec <code>prefers-reduced-motion</code>, ce qui est une ligne de
                  CSS, pas un chantier.
                </p>
                <p>
                  La règle simple : si l&apos;animation disparaît, l&apos;utilisateur perd-il
                  une information ? Si oui, elle est fonctionnelle et on la garde. Si non, elle
                  est décorative, et elle doit être discrète ou absente.
                </p>
                <p>
                  À éviter : les animations au scroll qui retardent l&apos;affichage du
                  contenu. Elles donnent l&apos;impression d&apos;un site lent, parce
                  qu&apos;elles le rendent lent.
                </p>

                <h2 id="design-system">5. Les design systems deviennent adaptatifs</h2>

                <Figure
                  src="/assets/img/guides/tendances-2027-design-system.webp"
                  width={1600}
                  height={1000}
                  alt="Planche de design system : couleurs, échelle typographique, boutons, états de formulaire et règles d'usage."
                  caption="Un système, pas un thème : couleurs, typographie, espacements et états définis une fois, réutilisés partout."
                />

                <p>
                  Un design system, c&apos;est la boîte à outils de votre marque : couleurs,
                  typographies, espacements, boutons, formulaires, règles d&apos;usage. Ce
                  n&apos;est pas un PDF rangé dans un dossier, c&apos;est ce qui permet à votre
                  site, votre newsletter et votre prochaine campagne de se ressembler sans
                  repartir de zéro.
                </p>
                <p>
                  La nouveauté, c&apos;est l&apos;adaptation : un même système produit un thème
                  clair et un thème sombre, une version sobre pour les pages institutionnelles
                  et une version affirmée pour les campagnes, sans casser la cohérence. Chaque
                  nouveau support coûte moins cher, et les cartes de visite arrêtent de partir
                  dans une troisième typographie.
                </p>
                <p>
                  À éviter : acheter un design system générique et l&apos;appliquer tel quel.
                  Un système sans vos décisions n&apos;est qu&apos;un kit de composants de plus.
                </p>

                <h2 id="accessibilite">6. L&apos;accessibilité passe de la case à cocher au design</h2>
                <p>
                  Depuis juin 2025, l&apos;European Accessibility Act impose des exigences
                  d&apos;accessibilité à de nombreux services numériques en Europe, avec des
                  exemptions pour les très petites structures. Au-delà de l&apos;obligation,
                  une part importante de vos visiteurs vieillit, voit mal, navigue au clavier
                  ou consulte votre site en plein soleil.
                </p>
                <p>
                  L&apos;accessibilité n&apos;est plus un audit fait après coup. Elle entre
                  dans la maquette : contrastes dès le choix des couleurs, focus visibles,
                  libellés de formulaires clairs, texte qui résiste au zoom, navigation au
                  clavier, alternatives textuelles utiles.
                </p>
                <p>
                  Ces décisions améliorent l&apos;expérience de tout le monde. Un bouton
                  lisible en plein soleil est lisible pour tous, et un formulaire clair
                  convertit mieux.
                </p>
                <p>
                  À éviter : le widget d&apos;accessibilité ajouté en pied de page pour se
                  donner bonne conscience. S&apos;il corrige à la place du design, c&apos;est
                  que le design est à revoir.
                </p>

                <h2 id="performance">7. La performance reste la tendance la plus rentable</h2>

                <Figure
                  src="/assets/img/guides/tendances-2027-performance.webp"
                  width={1600}
                  height={900}
                  alt="Panneau de métriques web : LCP passé de 4,4 à 1,8 seconde, INP de 310 à 120 millisecondes, CLS de 0,249 à 0,02, et poids des images réduit de 596 à 118 kilo-octets."
                  caption="Les trois métriques qui comptent, avant et après arbitrage. Le gain vient presque toujours des images et des scripts tiers."
                />

                <p>
                  C&apos;est la moins spectaculaire et la plus rentable. Les seuils n&apos;ont
                  pas changé : un affichage principal sous 2,5 secondes, une interaction sous
                  200 millisecondes, une mise en page stable, sans décalage supérieur à 0,1.
                </p>
                <p>
                  Trois chantiers suffisent souvent à transformer un site lent : des images au
                  bon format et à la bonne taille, un chargement différé pour ce qui n&apos;est
                  pas visible, des polices qui ne bloquent pas l&apos;affichage.
                </p>
                <p>
                  Sur les sites que j&apos;audite, la cause numéro un reste l&apos;image. Une
                  bannière exportée en 3000 pixels pour un affichage de 400, c&apos;est
                  plusieurs centaines de kilo-octets envoyés pour rien à chaque visite, souvent
                  sur un forfait mobile. C&apos;est le premier point que je regarde sur un{" "}
                  <Link href={serviceHref("site-ecommerce")}>site e-commerce</Link>.
                </p>
                <p>
                  À éviter : croire qu&apos;un beau site est forcément lourd. Les plus élégants
                  sont souvent les plus légers, parce que quelqu&apos;un a arbitré.
                </p>

                <h2 id="imperfection">8. L&apos;imperfection humaine comme différenciateur</h2>
                <p>
                  À mesure que les sites générés se ressemblent, ce qui n&apos;est pas parfait
                  devient un signe de vérité : une photo prise dans l&apos;atelier, un trait à
                  la main, une texture de papier, une note en marge.
                </p>
                <p>
                  L&apos;imperfection fonctionne quand elle est choisie et contenue : un seul
                  élément organique dans une grille rigoureuse, une photo non retouchée à côté
                  d&apos;une mise en page très propre. Un artisan qui montre ses mains inspire
                  plus confiance qu&apos;une poignée de main achetée en banque d&apos;images.
                </p>
                <p>
                  C&apos;est aussi un argument commercial. Un studio qui montre ses esquisses
                  ratées, une marque qui montre l&apos;envers du décor, inspirent plus confiance
                  qu&apos;une communication lisse.
                </p>
                <p>
                  À éviter : simuler l&apos;authenticité. Le faux grain, la fausse écriture
                  manuscrite et les photos « spontanées » qui sortent d&apos;une banque
                  d&apos;images produisent l&apos;effet inverse.
                </p>

                <h2 id="culture">9. Les références culturelles remplacent le design globalisé</h2>
                <p>
                  Pendant longtemps, le bon design était supposé être neutre, sans accent, sans
                  référence locale. Résultat : des sites identiques de Paris à São Paulo, avec
                  les mêmes photos et les mêmes icônes.
                </p>
                <p>
                  La tendance inverse est visible : typographies qui portent une culture,
                  motifs hérités, couleurs locales, références assumées à un territoire ou à une
                  histoire. Pour une marque, cela crée une reconnaissance immédiate et une
                  raison de choisir.
                </p>
                <p>
                  La limite est claire : une référence culturelle se travaille avec les
                  personnes concernées, pas en piochant un motif sur Pinterest.
                </p>
                <p>
                  Pour un commerce de quartier, c&apos;est souvent la piste la plus rentable :
                  assumez votre rue, votre ville, votre clientèle. Vous n&apos;aurez pas
                  l&apos;air d&apos;un site international, vous aurez l&apos;air d&apos;être là.
                  C&apos;est aussi le travail de{" "}
                  <Link href={serviceHref("direction-artistique")}>direction artistique</Link>.
                </p>

                <h2 id="glassmorphism">10. Le glassmorphism revient, avec parcimonie</h2>
                <p>
                  Les panneaux translucides, flous, posés sur une image, reviennent. C&apos;est
                  joli sur une maquette, plus délicat en production : le flou coûte en
                  performance, et le texte posé dessus perd vite en lisibilité.
                </p>
                <p>
                  La version raisonnable : réserver le verre à une carte, un menu, un bandeau,
                  jamais à un paragraphe entier. Vérifier le contraste du texte sur le fond le
                  plus clair comme sur le fond le plus sombre. Prévoir une couleur de repli si{" "}
                  <code>backdrop-filter</code> n&apos;est pas supporté.
                </p>
                <p>
                  Bien utilisé, l&apos;effet donne de la profondeur sans alourdir. Mal utilisé,
                  il donne l&apos;impression d&apos;un site de 2021 qui a installé un thème.
                </p>

                <h2 id="couleurs">11. Les couleurs franches sortent du beige sécurisé</h2>
                <p>
                  Après des années de palettes sable, taupe et vert sauge, les couleurs
                  saturées reviennent : rouges profonds, bleus électriques, verts acides,
                  oranges brûlés. Pas en fond plein écran partout, plutôt en accent : un
                  bouton, un filet, un chiffre clé, une section.
                </p>
                <p>
                  Le bénéfice est immédiat : une couleur franche crée un point de repère et
                  rend une page mémorable. Le risque aussi : sans système, elle devient un
                  patchwork.
                </p>
                <p>
                  La méthode : une couleur dominante, une couleur d&apos;accent, deux neutres,
                  des règles écrites. Puis un test de contraste sur chaque association, comme
                  dans le <Link href={routes.testerSonLogo}>test de logo</Link>. Une couleur qui
                  échoue au contraste n&apos;est pas une bonne couleur, même si elle est à la
                  mode.
                </p>

                <h2 id="ignorer">12. Ce qu&apos;on ignore volontairement en 2027</h2>
                <p>
                  Toutes les tendances ne méritent pas votre budget. Celles que je conseille
                  d&apos;ignorer :
                </p>
                <ul>
                  <li>Les curseurs personnalisés, qui cassent les habitudes et n&apos;apportent rien.</li>
                  <li>Le scroll horizontal, pénible au trackpad et souvent cassé sur mobile.</li>
                  <li>La 3D partout, coûteuse à produire et rarement utile à la compréhension.</li>
                  <li>Les animations d&apos;entrée qui retardent le contenu.</li>
                  <li>Les interfaces générées par IA sans direction, qui se ressemblent toutes.</li>
                  <li>Les dark patterns déguisés en personnalisation.</li>
                </ul>
                <p>
                  Une tendance qui demande un tutoriel pour être comprise n&apos;est pas une
                  tendance, c&apos;est une contrainte imposée au visiteur.
                </p>

                <h2 id="decider">13. Comment décider pour votre site</h2>
                <p>Trois questions suffisent à trier.</p>
                <ol>
                  <li>
                    Est-ce que cela aide le visiteur à comprendre, choisir ou acheter ? Si non,
                    ce n&apos;est pas prioritaire.
                  </li>
                  <li>
                    Est-ce que cela tient dans votre budget de production et de maintenance ? Un
                    site qu&apos;on ne peut pas mettre à jour vieillit en six mois.
                  </li>
                  <li>
                    Est-ce que cela vous ressemble ? Si la tendance pourrait être copiée à
                    l&apos;identique par un concurrent, elle n&apos;est pas encore votre identité.
                  </li>
                </ol>
                <p>
                  Ensuite, on teste. Une variante, deux semaines, un indicateur : clics sur le
                  bouton, profondeur de scroll, demandes de devis. Le goût personnel est un
                  point de départ, jamais une preuve. Un{" "}
                  <Link href={routes.calculateurBudgetIdentite}>calculateur de budget</Link>{" "}
                  aide à cadrer avant de choisir.
                </p>

                <h2 id="garder">Ce qu&apos;on garde chez Sujee en 2027</h2>
                <p>
                  Trois choses, concrètement. Une typographie forte et lisible. Une couleur qui
                  sert de signal, pas de décor. Et des pages rapides, accessibles, qui vont
                  droit au but.
                </p>
                <p>
                  Le reste, on l&apos;utilise quand il sert le projet. Pas parce qu&apos;un
                  classement annuel l&apos;a mis en première position.
                </p>
                <p>
                  Si votre site date d&apos;avant 2024, le premier chantier n&apos;est
                  probablement pas une refonte complète. C&apos;est un audit : ce qui charge, ce
                  qui bloque, ce qui convertit, ce qu&apos;on peut corriger en une semaine.
                </p>

                <h2 id="faq">Questions fréquentes</h2>
                {faqItems.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}

                <div className={styles.sources}>
                  <h2 id="sources">Sources</h2>
                  <ul>
                    <li>
                      Kirki, « Top Web Design Trends for 2027 », liste de dix tendances utilisée
                      comme point de départ :{" "}
                      <a
                        href="https://kirki.com/blog/web-design-trends-for-2027/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        kirki.com
                      </a>
                    </li>
                    <li>
                      Seuils Core Web Vitals :{" "}
                      <a
                        href="https://web.dev/articles/vitals"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        web.dev
                      </a>
                    </li>
                    <li>European Accessibility Act, applicabilité depuis le 28 juin 2025.</li>
                  </ul>
                  <p className={styles.note}>
                    Les tendances citées sont des signaux observés à la date de publication, pas
                    des prédictions. Elles seront réévaluées après les premiers retours terrain.
                  </p>
                </div>
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
              <p>Un site qui suit les tendances, ou un site qui vend ?</p>
              <p className={styles.ctaText}>
                Un audit de trois points : vitesse, lisibilité, chemins de conversion. Vous
                repartez avec la liste des corrections, même si vous ne travaillez pas avec le
                studio.
              </p>
            </div>
            <div className={styles.ctaLinks}>
              <Link className="btn-fill btn-fill--light" href={routes.contact}>
                Parler de votre projet <span aria-hidden="true">↗</span>
              </Link>
              <Link className="btn-line btn-line--light" href={serviceHref("identite-de-marque")}>
                Voir l&apos;offre identité de marque
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
