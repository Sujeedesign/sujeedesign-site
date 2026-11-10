import type { ReactNode } from "react";
import Link from "next/link";
import Faq from "@/components/Faq";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./GuideTendances2027.module.css";

export const pageMeta = {
  title: "Tendances web design 2027 : 8 signaux à suivre",
  description:
    "Huit tendances web design 2027 passées au filtre du réel : ce que les sites de référence font déjà, ce que ça coûte, et ce qu'il vaut mieux ignorer.",
};

/**
 * Réponse courte servie en haut de page (bloc « En bref ») et première entrée
 * du `FAQPage`. Elle ne fait que résumer la section « Ce qu'on garde » : ne
 * jamais y introduire un chiffre ou une promesse absente du texte plus bas.
 */
export const aeo = {
  question: "Quelles tendances web design compter en 2027 ?",
  answer:
    "Huit signaux dominent : une seule police à très grande échelle, une couleur d'accent franche, une mise en page éditoriale, un mode sombre pensé comme un système, un motion discret, la 3D réservée aux projets qui la justifient, l'IA dans la production et une preuve humaine visible. Trois sont rentables pour une PME : la typographie, la couleur et la vitesse.",
};

export const faqItems = [
  {
    question: "Faut-il refaire son site en 2027 ?",
    answer:
      "Non, pas par principe. Un site lisible, rapide et à jour sur le fond vaut mieux qu'un site refait pour suivre une mode. Refaites-le si le vôtre ne convertit plus, s'il est lent sur mobile ou si votre offre a changé.",
  },
  {
    question: "Une seule police suffit-elle pour un site de PME ?",
    answer:
      "Oui, dans la majorité des cas. Une famille variable bien choisie couvre le titre, le texte et les libellés, avec un fichier plus léger que deux familles. La hiérarchie se construit alors sur la taille, la graisse et l'espace, pas sur l'accumulation de polices.",
  },
  {
    question: "Le mode sombre est-il obligatoire ?",
    answer:
      "Non. Il devient pertinent quand le site est un outil consulté longtemps, le soir, ou quand la marque assume une identité sombre. Sur un site vitrine, il coûte un thème de plus à dessiner et à tester. À faire seulement si le produit le justifie.",
  },
  {
    question: "Combien coûte la mise à niveau d'un site existant ?",
    answer:
      "Chez nous, une refonte complète tourne autour de 1 900 € en moyenne, pour 3,5 à 5,5 jours de travail. Une remise à niveau typographique, couleur et performance se compte en jours. Une refonte avec design system se compte en semaines. Le devis doit distinguer les deux.",
  },
  {
    question: "La 3D et le WebGL sont-ils rentables pour une PME ?",
    answer:
      "Rarement en tant que décor. Ils deviennent rentables quand l'objet 3D aide à comprendre ou à configurer un produit, comme un meuble, une voiture ou une machine. Sinon, une bonne photo et une page rapide rapportent davantage.",
  },
  {
    question: "Les contenus aidés par l'IA sont-ils pénalisés par Google ?",
    answer:
      "Pas en tant que tels. Google évalue l'utilité et la fiabilité d'une page, pas la méthode de production. Un texte généré sans vérification, sans exemple et sans relecture se classe mal parce qu'il n'apporte rien, pas parce qu'il est généré.",
  },
];

const SOMMAIRE = [
  { href: "#typographie", label: "1. Une seule police" },
  { href: "#couleur", label: "2. La couleur signal" },
  { href: "#editorial", label: "3. La page éditoriale" },
  { href: "#sombre", label: "4. Le sombre systémique" },
  { href: "#motion", label: "5. Le motion utile" },
  { href: "#trois-d", label: "6. La 3D au devis" },
  { href: "#ia", label: "7. L’IA dans le process" },
  { href: "#preuve", label: "8. La preuve humaine" },
  { href: "#chiffres", label: "Les chiffres" },
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
  caption: ReactNode;
}) {
  return (
    <figure className={styles.figure}>
      <img src={src} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
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
              <span className={styles.accent}>2027</span> : huit signaux,
              <br />
              pas une liste de styles.
            </h1>
            <div className={styles.headMeta}>
              <p className="intro">
                Ce que les sites de référence font déjà, ce que ça coûte vraiment, et ce
                qu&apos;il vaut mieux ignorer quand on tient un budget.
              </p>
              <p className={styles.byline}>
                Par Sujeepan Sabesan · 10 novembre 2026 · 13 min de lecture
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          <div className="sec-head rv">
            <div className="sec-num">En bref</div>
            <div>
              <h2>{aeo.question}</h2>
              <p>{aeo.answer}</p>
            </div>
          </div>
        </div>
      </section>

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
                  Chaque automne, la même liste revient. Interfaces liquides, couleurs
                  impossibles, animations partout. On la lit, on la trouve belle, on
                  l&apos;oublie, et le site reste celui de 2023.
                </p>
                <p>
                  Cette année, on a changé de méthode. Plutôt que de compiler des captures
                  spectaculaires, on est parti de ce que les sites de référence font
                  réellement, puis on a filtré avec une seule question : qu&apos;est-ce que
                  ça change pour une PME, un commerce ou un indépendant qui doit vendre ?
                </p>
                <p>
                  Trois sources : l&apos;étude typographique de Muzli sur 2 190 sites
                  publiée en octobre 2026, les projets repérés dans Muzli Picks, Awwwards et
                  Behance en 2025 et 2026, et les chiffres de nos propres chantiers. Pour chaque
                  tendance : le signal, l&apos;exemple, le coût, et le moment où il faut
                  s&apos;arrêter.
                </p>

                <div className={styles.tldr}>
                  <p className={styles.tldrTitle}>L&apos;essentiel en six points</p>
                  <ul>
                    <li>
                      <a href="#typographie">Une seule police</a> bien choisie bat trois
                      familles mal assorties. 60 % des sites étudiés par Muzli n&apos;en
                      utilisent qu&apos;une.
                    </li>
                    <li>
                      <a href="#couleur">La couleur revient</a>, mais comme signal : un
                      accent fort, quatre neutres, des règles écrites.
                    </li>
                    <li>
                      <a href="#editorial">La mise en page redevient éditoriale</a> : grille
                      visible, filets, notes, hiérarchie. Moins de cartes, plus de structure.
                    </li>
                    <li>
                      <a href="#sombre">Le mode sombre</a> n&apos;est pas un thème de plus,
                      c&apos;est un système de tokens à tenir.
                    </li>
                    <li>
                      <a href="#trois-d">HTML in Canvas</a> est le vrai changement technique
                      de 2027 : des interfaces vivantes dans une scène 3D.
                    </li>
                    <li>
                      <a href="#preuve">L&apos;uniformisation est mesurée</a> : une paire de
                      sites quasi identiques sur 200 en 2025-2026, contre 1 sur 1 100 en
                      2021. La preuve humaine devient l&apos;avantage.
                    </li>
                  </ul>
                </div>

                <Figure
                  src="/assets/img/guides/tendances-2027-ouverture.webp"
                  width={1600}
                  height={900}
                  alt="Couverture du guide : le nombre 2027 en noir et orange, et une maquette de page d'accueil pour une identité de marque."
                  caption="Huit signaux, ramenés à ce qu'un site doit vraiment faire : comprendre, rassurer, convertir."
                />

                <p>
                  Huit tendances, trois de moins que la plupart des listes, et une seule
                  règle : une tendance qui ne se voit pas dans le budget ni dans les chiffres
                  n&apos;est pas une tendance, c&apos;est un goût personnel.
                </p>

                <h2 id="typographie">1. Une seule police, mais une échelle qui prend la page</h2>
                <p>
                  Le signal est net. Sur 2 190 sites repérés dans 24 galeries de design, 60 %
                  n&apos;utilisent qu&apos;une seule famille pour le titre et le corps.
                  Inter apparaît sur 13 % de l&apos;ensemble, et sur 24 % des sites Framer,
                  où c&apos;est simplement le réglage par défaut. Aucune autre police
                  n&apos;atteint 5 %. Et 23 % des sites ajoutent une chasse fixe pour les
                  libellés, sans compter une deuxième famille de texte.
                </p>
                <p>
                  La hiérarchie ne vient donc plus du contraste entre deux familles. Elle
                  vient de l&apos;échelle, de la graisse et de l&apos;espace. Le titre médian
                  mesuré est de 64 px pour un corps de 16 px, avec un interligne de 1,4 à 1,5.
                  Un titre trois à quatre fois plus gros que le texte, voilà la vraie
                  tendance. Pas la troisième police.
                </p>
                <Figure
                  src="/assets/img/guides/muzli/namma.webp"
                  width={800}
                  height={600}
                  alt="Page d'accueil de Studio Namma : phrase manifeste en très grandes capitales noires, interrompue par un carrousel de projets colorés."
                  caption={<>Projet : <strong>Studio Namma</strong>, agence de design à Paris. Une famille display à l&apos;échelle monumentale, un mono réservé aux libellés.<br />
                  <a href="https://jasminegunarto.com/" target="_blank" rel="noopener noreferrer">Voir le site</a> · Repéré dans <a href="https://muz.li/blog/the-best-creative-websites-of-the-month-april-2026/" target="_blank" rel="noopener noreferrer">Muzli Picks</a>.</>}
                />

                <p>
                  Exemple de ce que ça produit :{" "}
                  <a
                    href="https://www.awwwards.com/sites/bleibtgleich26"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    bleibtgleich&apos;26
                  </a>
                  , un portfolio qui tient toute sa personnalité sur une typographie
                  expressive, du mouvement et une grille éditoriale, sans multiplier les
                  effets.
                </p>
                <p>
                  Ce que ça change pour vous : un seul fichier de police à charger, donc une
                  page plus légère, et une cohérence qui tient sur le site, la newsletter et
                  les documents commerciaux. Une famille variable bien choisie couvre le
                  titre, le texte et les libellés.
                </p>
                <p>
                  Le coût : rien si la décision est prise à la maquette. Un à deux jours si
                  on reprend un site existant, parce qu&apos;il faut reconstruire
                  l&apos;échelle typographique et vérifier chaque rupture sur mobile.
                </p>
                <p>
                  À éviter : prendre une police d&apos;affichage pour le corps de texte, et
                  garder trois familles « par sécurité ». C&apos;est exactement ce qui donne
                  l&apos;impression d&apos;un site assemblé plutôt que dessiné.
                </p>

                <h2 id="couleur">2. La couleur redevient un signal</h2>
                <p>
                  Après dix ans de sable, de taupe et de vert sauge, les couleurs saturées
                  reviennent. Pas en fond plein écran partout : en accent. Un bouton, un
                  filet, un chiffre clé, une section. La différence avec la période
                  précédente, c&apos;est que la couleur est désormais traitée comme une
                  donnée du système, pas comme une décoration.
                </p>
                <p>
                  Un bon exemple de tenue :{" "}
                  <a
                    href="https://davincis.digital/rbyba/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Red Blue Yellow Black Again
                  </a>
                  , construit sur les primaires, la géométrie et une grille stricte. Trois
                  couleurs, zéro ambiguïté, une identité immédiatement reconnaissable.
                </p>

                <Figure
                  src="/assets/img/guides/muzli/mechanik.webp"
                  width={800}
                  height={600}
                  alt="Spécimen GT Mechanik de Grilli Type : grand mot MCNK en magenta, modules vert menthe, cercles jaunes et lignes techniques sur fond blanc."
                  caption={<>Autre registre : <strong>GT Mechanik</strong>, spécimen de la fonderie <strong>Grilli Type</strong>. Trois aplats francs, une grille technique, zéro dégradé.<br />
                  <a href="https://gt-mechanik.com/" target="_blank" rel="noopener noreferrer">Voir le projet</a> · Repéré dans <a href="https://muz.li/blog/the-best-creative-websites-of-the-month-april-2026/" target="_blank" rel="noopener noreferrer">Muzli Picks</a>.</>}
                />
                <p>
                  Ce que ça change : une dominante, un accent, deux neutres, des règles
                  écrites. Le reste est du décor. Une couleur qui échoue au contraste
                  n&apos;est pas une bonne couleur, même si elle est à la mode : 4,5:1
                  minimum pour le texte courant, 3:1 pour les grands titres.
                </p>
                <p>
                  Le coût est presque nul en production. Le vrai coût, c&apos;est la
                  décision : un atelier d&apos;une heure pour choisir, puis des tests de
                  contraste sur chaque association. C&apos;est le chantier le plus rentable
                  de la liste avec la typographie.
                </p>
                <p>
                  À éviter : l&apos;accent partout, les palettes de douze couleurs
                  « pour être libre », et le texte gris clair sur fond blanc qui a l&apos;air
                  élégant sur un écran de studio et illisible en plein soleil.
                </p>

                <h2 id="editorial">3. La page redevient éditoriale</h2>
                <p>
                  Les meilleurs sites de 2026 ressemblent de plus en plus à des magazines et
                  de moins en moins à des tableaux de bord. Grille visible, filets, notes de
                  marge, compositions asymétriques, images qui prennent toute la largeur. Le
                  contenu redevient le design.
                </p>
                <p>
                  Deux exemples chez les studios qui gagnent régulièrement :{" "}
                  <a
                    href="https://www.awwwards.com/sites/cominvi"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CoMinVi
                  </a>{" "}
                  et{" "}
                  <a
                    href="https://www.awwwards.com/sites/era-residence"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    ERA Residence
                  </a>
                  . Le premier alterne paysage industriel et données, le second joue sur des
                  arcs et des couches d&apos;images. Dans les deux cas, la structure raconte
                  quelque chose avant même qu&apos;on lise.
                </p>
                <Figure
                  src="/assets/img/guides/muzli/obys.webp"
                  width={800}
                  height={600}
                  alt="Page d'accueil d'Obys : panneau blanc posé sur une photo de feuillage floue, logo en haut à gauche, colonne de vignettes encadrée de parenthèses et notes en petits corps."
                  caption={<>Projet : <strong>Obys</strong>, agence de design. Grille, notes de marge, vignettes et parenthèses : la page se lit comme une double page.<br />
                  <a href="https://obys.agency/" target="_blank" rel="noopener noreferrer">Voir le site</a> · Repéré dans <a href="https://muz.li/blog/the-best-creative-websites-of-the-month-april-2026/" target="_blank" rel="noopener noreferrer">Muzli Picks</a>.</>}
                />

                <p>
                  Ce que ça change pour une PME : arrêter de tout mettre dans des cartes
                  arrondies de la même taille. Un titre, un paragraphe, un chiffre et une
                  image n&apos;ont pas le même poids. La page doit le montrer.
                </p>
                <p>
                  Le coût : du temps de maquette, pas de développement supplémentaire. La
                  difficulté est le mobile, où une grille asymétrique doit se réordonner
                  proprement au lieu de simplement s&apos;empiler.
                </p>
                <p>
                  À éviter : l&apos;éditorial simulé. Grosses citations vides, faux
                  surtitres, photos d&apos;illustration sans lien avec le propos. La forme ne
                  sauve pas un contenu creux.
                </p>

                <h2 id="sombre">4. Le sombre n&apos;est plus un thème, c&apos;est un système</h2>
                <p>
                  Les outils que les designers utilisent tous les jours, Linear, Raycast,
                  Arc, Warp, ont installé le dark-first comme standard de qualité perçue. Ce
                  n&apos;est pas une question de goût : c&apos;est une manière de traiter la
                  profondeur.
                </p>
                <p>
                  La méthode qui tient : quatre niveaux de surface, une élévation obtenue par
                  la luminance (5 à 8 % de clarté par palier) et non par des ombres, des
                  tokens sémantiques plutôt que des couleurs codées en dur, un texte
                  off-white entre #E0E0E0 et #F0F0F0, jamais du blanc pur sur du noir pur.
                </p>
                <Figure
                  src="/assets/img/guides/muzli/looper.webp"
                  width={800}
                  height={600}
                  alt="Visuel du projet Looper par basement.studio : silhouette casquée à visière lumineuse entourée d'écrans cathodiques, néons rouges et orange sur fond noir."
                  caption={<>Projet : <strong>Looper</strong> par <strong>basement.studio</strong>. Noir profond, néons et 3D traités comme un système, pas comme un filtre.<br />
                  <a href="https://looper.basement.studio/" target="_blank" rel="noopener noreferrer">Voir le projet</a> · Repéré dans <a href="https://muz.li/blog/the-best-creative-websites-of-the-month-april-2026/" target="_blank" rel="noopener noreferrer">Muzli Picks</a>.</>}
                />

                <p>
                  Ce que ça change : le mode sombre n&apos;est pas un deuxième site. C&apos;est
                  un thème de plus dans le même système. Si vos couleurs sont définies par
                  leur rôle (fond, surface, texte, accent, bordure) et non par leur valeur,
                  le thème se déduit.
                </p>
                <p>
                  Le coût : un thème à dessiner, à tester et à maintenir. Comptez une à deux
                  journées sur un site vitrine, davantage sur une boutique où les visuels
                  produits doivent rester fidèles.
                </p>
                <p>
                  À éviter : inverser les couleurs à la fin du projet et appeler ça un mode
                  sombre. Et le dark par défaut sur un site de contenu lu en journée : il
                  n&apos;apporte rien et fatigue.
                </p>

                <h2 id="motion">5. Le motion redevient de la mise en scène</h2>
                <p>
                  Après des années d&apos;animations d&apos;entrée sur chaque section, le
                  mouvement se concentre. Une ouverture orchestrée, deux ou trois scènes
                  liées au scroll, des transitions qui expliquent un changement d&apos;état.
                  Le reste disparaît.
                </p>
                <p>
                  Le cas le plus lisible reste{" "}
                  <a
                    href="https://www.awwwards.com/sites/anime-js"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Anime.js
                  </a>
                  : une machine tridimensionnelle qui se démonte en schémas, puis en
                  démonstrations. L&apos;animation sert la démonstration du produit. Elle ne
                  décore pas.
                </p>
                <p>
                  Ce que ça change : la question n&apos;est plus « quelle animation ? » mais
                  « quel moment mérite d&apos;être mis en scène ? ». Un changement de
                  chapitre, une confirmation d&apos;ajout au panier, une ouverture de fiche
                  produit. Trois moments, pas trente.
                </p>
                <p>
                  Le coût : deux à cinq jours de développement pour une ouverture et deux
                  scènes propres, avec une bibliothèque comme GSAP et un seul écouteur de
                  scroll. Et une ligne de CSS pour respecter{" "}
                  <code>prefers-reduced-motion</code>, ce qui protège les personnes sensibles
                  au mouvement.
                </p>
                <p>
                  À éviter : le scroll-jacking, les contenus qui n&apos;apparaissent
                  qu&apos;après une seconde d&apos;attente, et les animations qui font croire
                  à un site lent parce qu&apos;elles le rendent lent.
                </p>

                <h2 id="trois-d">6. La 3D sort du bonus et entre au devis</h2>
                <p>
                  Deux changements techniques rendent la 3D sérieuse en 2026. D&apos;abord,
                  WebGPU est devenu le moteur par défaut de three.js : on parle désormais
                  d&apos;un million de particules en temps réel sur un téléphone, ou
                  d&apos;une scène complète en 6 Mo, moins qu&apos;une vidéo de hero.
                </p>
                <p>
                  Ensuite, et c&apos;est le vrai basculement : Chrome sait peindre du HTML
                  vivant dans le canvas. L&apos;origin trial a démarré avec Chrome 148 et a
                  été prolongé jusqu&apos;à Chrome 160 en septembre 2026, avec le support de
                  three.js depuis avril. Concrètement, un bouton posé sur un objet 3D reste
                  un bouton : cliquable, sélectionnable, lisible par un lecteur d&apos;écran,
                  indexable.
                </p>
                <p>
                  Ce que ça change : la vitrine d&apos;un produit peut faire tourner le vrai
                  produit. Un configurateur peut être une scène, pas une suite de formulaires.
                  Un effet peut s&apos;appliquer à un vrai titre sans le transformer en image,
                  donc sans perdre le référencement.
                </p>
                <Figure
                  src="/assets/img/guides/muzli/unknown.webp"
                  width={800}
                  height={600}
                  alt="Page d'accueil de l'agence THE UNKNOWN : titre blanc sur une sphère lumineuse, vague 3D cyan et paysage montagneux dans un dégradé rose et violet."
                  caption={<>Projet : <strong>THE UNKNOWN</strong>, agence de Montréal. Une scène 3D en ouverture, un titre qui reste du texte.<br />
                  <a href="https://theunknown.tv/en" target="_blank" rel="noopener noreferrer">Voir le site</a> · Repéré dans <a href="https://muz.li/blog/the-best-creative-websites-of-the-month-april-2026/" target="_blank" rel="noopener noreferrer">Muzli Picks</a>.</>}
                />

                <p>
                  Le coût, lui, n&apos;a pas baissé : assets 3D, intégration, recette sur
                  mobile. Comptez plusieurs jours de production, et un budget de performance à
                  tenir. C&apos;est rentable quand la 3D aide à comprendre ou à configurer,
                  pas quand elle sert de fond.
                </p>
                <p>
                  À éviter : la 3D sur le chemin critique, c&apos;est-à-dire avant que le
                  visiteur puisse lire votre offre. Et la 3D pour une PME dont le produit
                  n&apos;a rien à montrer en volume.
                </p>

                <h2 id="ia">7. L&apos;IA déplace le coût, pas la décision</h2>
                <p>
                  En 2026, l&apos;IA servait surtout à produire une image ou un texte. En
                  2027, elle s&apos;installe plus tôt : exploration de directions, variantes
                  de mise en page, génération de composants, contrôle de contraste, premières
                  versions de contenu.
                </p>
                <p>
                  Les chiffres commencent à être publiés. Muzli a fait tourner les mêmes trois
                  briefs sur deux modèles concurrents en octobre 2026 : 17, 8 et 11 minutes
                  pour le second, 1,88 $ au total, contre 81 minutes pour le premier sur le
                  seul site vitrine. Leur conclusion est la bonne : on ne payait pas le
                  process, on payait le coût de l&apos;erreur. Quand une exploration coûte
                  moins d&apos;un euro, on en demande trois au lieu d&apos;une.
                </p>
                <p>
                  Ce que ça change pour un studio ou une PME : le brief devient le livrable
                  clé. Une IA exécute vite ce qu&apos;on décrit bien. Elle ne choisit pas la
                  stratégie, ne connaît pas votre client et ne voit pas ce qui manque.
                </p>
                <p>
                  Le coût : un abonnement, du temps de brief et surtout du temps de recette.
                  La relecture humaine n&apos;est pas optionnelle, c&apos;est le seul endroit
                  où se joue la qualité.
                </p>
                <p>
                  À éviter : publier sans relire, générer vingt variantes sans critère de
                  choix, et automatiser la relation client. Un chatbot qui répond « je vous
                  invite à nous contacter » à une question de prix ne fait pas gagner du
                  temps, il perd un prospect.
                </p>

                <h2 id="preuve">8. La preuve humaine devient le différenciateur</h2>
                <p>
                  L&apos;uniformisation n&apos;est pas une impression. Muzli a comparé 6 346
                  projets de 2015 à 2026 : la probabilité de tomber sur deux sites quasi
                  identiques dans la même année est passée d&apos;une paire sur 1 100 en 2021
                  à une sur 200 en 2025-2026. Le feed s&apos;est aussi resserré : plus de la
                  moitié des projets sont des sites, contre un sur neuf en 2015.
                </p>
                <p>
                  La cause n&apos;est pas un manque d&apos;idées. C&apos;est que tout le monde
                  regarde les mêmes galeries, utilise les mêmes composants et part des mêmes
                  modèles. La réponse logique est donc ailleurs : dans ce qui ne se copie pas.
                </p>
                <p>
                  Une photo prise dans l&apos;atelier, une main au travail, une matière, une
                  voix, un détail de quartier. Ce que les sites générés ne peuvent pas
                  produire. Pour un artisan, un commerce ou un indépendant, c&apos;est souvent
                  la piste la plus rentable de la liste, et la moins chère.
                </p>
                <Figure
                  src="/assets/img/guides/muzli/loli.webp"
                  width={800}
                  height={600}
                  alt="Page d'accueil du portfolio de Loli Laboureau : collage avec portrait noir et blanc, téléphone-banane jaune, bloc typographique bleu et affiche pastel."
                  caption={<>Projet : <strong>Loli Laboureau</strong>. Photo, collage, typographie rétro : une voix qu&apos;aucun modèle ne produit à l&apos;identique.<br />
                  <a href="https://www.lolilaboureau.com/" target="_blank" rel="noopener noreferrer">Voir le site</a> · Repéré dans <a href="https://muz.li/blog/the-best-creative-websites-of-the-month-april-2026/" target="_blank" rel="noopener noreferrer">Muzli Picks</a>.</>}
                />

                <p>
                  Le coût : une demi-journée de photo ou de vidéo, parfois zéro si vous avez
                  déjà des images de terrain. Aucun développement.
                </p>
                <p>
                  À éviter : simuler l&apos;authenticité. Faux grain, fausse écriture
                  manuscrite, photos « spontanées » achetées en banque d&apos;images. Le
                  résultat est exactement l&apos;inverse de l&apos;effet recherché.
                </p>

                <h2 id="chiffres">Les cinq chiffres à retenir</h2>
                <p>
                  Ils viennent de deux études publiées en octobre 2026 et des seuils de
                  performance du web. Ils suffisent à trier la moitié des tendances.
                </p>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Mesure</th>
                        <th>Valeur</th>
                        <th>Ce que ça dit</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Sites à une seule famille typographique</td>
                        <td>60 %</td>
                        <td>La hiérarchie passe par l&apos;échelle, pas par le nombre de polices.</td>
                      </tr>
                      <tr>
                        <td>Part d&apos;Inter sur les sites Framer</td>
                        <td>24 %</td>
                        <td>Le défaut d&apos;un outil devient le style d&apos;une époque.</td>
                      </tr>
                      <tr>
                        <td>Paires de sites quasi identiques, 2025&#8209;2026</td>
                        <td>1 sur 200</td>
                        <td>Contre 1 sur 1 100 en 2021 : l&apos;uniformisation est mesurable.</td>
                      </tr>
                      <tr>
                        <td>Seuil d&apos;affichage principal (LCP)</td>
                        <td>2,5 s</td>
                        <td>La tendance la plus rentable reste la vitesse.</td>
                      </tr>
                      <tr>
                        <td>Réactivité aux interactions (INP)</td>
                        <td>200 ms</td>
                        <td>Une animation lourde se paie ici, pas dans la maquette.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className={styles.source}>
                  Sources : étude typographique Muzli sur 2 190 sites, octobre 2026 ; étude
                  Muzli sur 6 346 projets, octobre 2026 ; seuils Core Web Vitals, web.dev.
                </p>

                <Figure
                  src="/assets/img/guides/tendances-2027-performance.webp"
                  width={1600}
                  height={900}
                  alt="Panneau de métriques web : LCP passé de 4,4 à 1,8 seconde, INP de 310 à 120 millisecondes, CLS de 0,249 à 0,02, et poids des images réduit de 596 à 118 kilo-octets."
                  caption="Les trois métriques qui comptent, avant et après arbitrage. Le gain vient presque toujours des images et des scripts tiers."
                />

                <h2 id="ignorer">Ce qu&apos;on ignore volontairement en 2027</h2>
                <p>
                  Toutes les tendances ne méritent pas votre budget. Celles qu&apos;on
                  conseille d&apos;ignorer, même quand elles sont primées :
                </p>
                <ul>
                  <li>Les curseurs personnalisés, qui cassent les habitudes sans rien apporter.</li>
                  <li>Le scroll horizontal, pénible au trackpad et souvent cassé sur mobile.</li>
                  <li>La 3D décorative, coûteuse à produire et rarement utile à la compréhension.</li>
                  <li>Les animations d&apos;entrée qui retardent l&apos;accès au contenu.</li>
                  <li>Le glassmorphism appliqué à un paragraphe entier, illisible sur photo.</li>
                  <li>Le mode sombre décrété sans usage qui le justifie.</li>
                  <li>La personnalisation qui exige un traceur pour un gain invisible.</li>
                  <li>Les dark patterns déguisés en expérience soignée.</li>
                </ul>
                <p>
                  Une tendance qui demande un tutoriel pour être comprise n&apos;est pas une
                  tendance, c&apos;est une contrainte imposée au visiteur.
                </p>

                <h2 id="decider">Comment décider pour votre site</h2>
                <p>Quatre questions suffisent à trier, dans cet ordre.</p>
                <ol>
                  <li>
                    Est-ce que cela aide le visiteur à comprendre, choisir ou acheter ? Si
                    non, ce n&apos;est pas prioritaire.
                  </li>
                  <li>
                    Est-ce que cela tient dans votre budget de production et de maintenance ?
                    Un site qu&apos;on ne peut pas mettre à jour vieillit en six mois.
                  </li>
                  <li>
                    Est-ce que cela vous ressemble ? Si la tendance peut être copiée à
                    l&apos;identique par un concurrent, elle n&apos;est pas encore votre
                    identité.
                  </li>
                  <li>
                    Est-ce que cela reste rapide et accessible sur un téléphone d&apos;entrée
                    de gamme, en 4G ? Si la réponse est non, le gain est déjà annulé.
                  </li>
                </ol>
                <p>
                  Ensuite, on chiffre. Chez nous, une refonte complète tourne autour de
                  1 900 € en moyenne pour 3,5 à 5,5 jours de travail. Un site vitrine sur
                  mesure démarre à 2 000 €, un WordPress à 2 750 €, une boutique Shopify à
                  4 000 €. Ces repères viennent de notre{" "}
                  <Link href={routes.guidePrixSite}>guide des prix d&apos;un site</Link>, pas
                  d&apos;une moyenne d&apos;agence.
                </p>
                <div className={styles.tableWrap}>
                  <table>
                    <thead>
                      <tr>
                        <th>Chantier</th>
                        <th>Effort</th>
                        <th>Effet attendu</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Échelle typographique et une seule famille</td>
                        <td>1 à 2 jours</td>
                        <td>Lisibilité, cohérence, page plus légère</td>
                      </tr>
                      <tr>
                        <td>Couleur d&apos;accent et contrastes</td>
                        <td>1 jour</td>
                        <td>Mémorisation, accessibilité</td>
                      </tr>
                      <tr>
                        <td>Images, polices, scripts tiers</td>
                        <td>2 à 5 jours</td>
                        <td>LCP et INP, donc conversion mobile</td>
                      </tr>
                      <tr>
                        <td>Design system à tokens</td>
                        <td>5 à 15 jours</td>
                        <td>Cohérence, coût des supports suivants</td>
                      </tr>
                      <tr>
                        <td>Motion scénarisé</td>
                        <td>2 à 5 jours</td>
                        <td>Perception de qualité, si le contenu suit</td>
                      </tr>
                      <tr>
                        <td>3D ou WebGL</td>
                        <td>10 jours et plus</td>
                        <td>Différenciation, seulement si le produit s&apos;y prête</td>
                      </tr>
                      <tr>
                        <td>Photo et preuve de terrain</td>
                        <td>0,5 à 2 jours</td>
                        <td>Confiance, différenciation durable</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  On teste ensuite. Une variante, deux semaines, un indicateur : clics sur le
                  bouton, profondeur de scroll, demandes de devis. Le goût personnel est un
                  point de départ, jamais une preuve.
                </p>

                <h2 id="garder">Ce qu&apos;on garde chez Sujee en 2027</h2>
                <p>
                  Trois choses, concrètement. Une typographie forte et lisible, avec une seule
                  famille et une échelle assumée. Une couleur qui sert de signal, pas de
                  décor. Et des pages rapides, accessibles, qui vont droit au but.
                </p>
                <p>
                  Le reste, on l&apos;utilise quand il sert le projet. Pas parce qu&apos;un
                  classement annuel l&apos;a mis en première position. Une tendance qui ne se
                  voit pas dans le budget ni dans les chiffres est un goût, et le goût se
                  discute.
                </p>
                <p>
                  Si votre site date d&apos;avant 2024, le premier chantier n&apos;est
                  probablement pas une refonte complète. C&apos;est un audit : ce qui charge,
                  ce qui bloque, ce qui convertit, ce qu&apos;on peut corriger en une semaine.
                </p>

                <Faq items={faqItems} />
                <div className={styles.sources}>
                  <h2 id="sources">Sources et méthode</h2>
                  <ul>
                    <li>
                      Muzli, « Font pairings 2026 », étude sur 2 190 sites de 24 galeries,
                      octobre 2026 :{" "}
                      <a
                        href="https://muz.li/blog/font-pairings-2026/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        muz.li
                      </a>
                    </li>
                    <li>
                      Muzli, « Are we out of new things? », analyse de 6 346 projets 2015-2026,
                      octobre 2026 :{" "}
                      <a
                        href="https://muz.li/blog/are-we-out-of-new-things/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        muz.li
                      </a>
                    </li>
                    <li>
                      Three.js Conf Paris, septembre 2026 : HTML in Canvas, origin trial Chrome
                      148 prolongé jusqu&apos;à Chrome 160, WebGPU par défaut dans three.js.
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
                    <li>
                      Projets cités : Awwwards, fiches bleibtgleich&apos;26, Anime.js, CoMinVi,
                      ERA Residence, et Red Blue Yellow Black Again pour Digital Da Vincis.
                    </li>
                    <li>
                      Visuels des projets : sélection{" "}
                      <a
                        href="https://muz.li/blog/the-best-creative-websites-of-the-month-april-2026/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Muzli Picks, avril 2026
                      </a>
                      . Images de Studio Namma, Grilli Type (GT Mechanik), Obys, basement.studio
                      (Looper), THE UNKNOWN et Loli Laboureau, utilisées en illustration avec
                      crédit et lien vers chaque création.
                    </li>
                    <li>
                      Prix :{" "}
                      <Link href={routes.guidePrixSite}>guide des prix d&apos;un site</Link>,
                      novembre 2026.
                    </li>
                  </ul>
                  <p className={styles.note}>
                    Les tendances citées sont des signaux observés à la date de publication,
                    pas des prédictions. Les chiffres attribués à Muzli viennent de leurs
                    études, pas d&apos;une mesure faite par nos soins. Ils seront réévalués
                    après les premiers retours terrain. Les visuels de projets restent la
                    propriété de leurs auteurs, crédités sous chaque image, et sont retirés
                    sur simple demande.
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
