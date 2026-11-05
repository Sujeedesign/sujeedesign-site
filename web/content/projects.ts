/**
 * Études de cas publiées sur /realisations.
 *
 * Une seule source pour : le sommaire de la page Réalisations, les fiches
 * projet et le plan du site. Ajouter un projet ici le publie partout.
 *
 * Règle éditoriale : aucun chiffre de résultat n'est inventé. Si une donnée
 * n'est pas connue, le champ est omis et l'interface ne l'affiche pas.
 */

export type ProjectImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type ProjectSection = {
  k: string;
  label: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type Project = {
  slug: string;
  index: string;
  name: string;
  client: string;
  year?: string;
  city?: string;
  disciplines: string[];
  pitch: string;
  scope: string;
  duration?: string;
  sections: ProjectSection[];
  results?: { value: string; label: string }[];
  /**
   * Visuel de couverture, indépendant de la galerie.
   *
   * Utilisé par la carte d'accueil, le film de /realisations et la vignette des
   * projets liés. Absent, la première image de la galerie fait office de
   * couverture. L'image de partage (Open Graph) reste le fichier dédié
   * `public/assets/img/og/<slug>.jpg`, au format 1200×630.
   */
  cover?: ProjectImage;
  /**
   * Couverture dédiée au mobile, en portrait 9:16 (master 1080×1920, 200 Ko max).
   *
   * Elle remplace `cover` sous 720 px de large, là où un paysage recadré en
   * `object-fit: cover` coupe le sujet : le hero d'accueil et le film de
   * /realisations occupent tout l'écran (≈0,46 de ratio en 390×844), donc un
   * master 9:16 y garde ~82 % de sa largeur contre ~58 % pour un 4:5.
   * Les cartes de l'accueil (2:3) et la vignette « projet suivant » se dérivent
   * du même fichier par recadrage centré : un seul master par projet.
   * Optionnelle : sans elle, le rendu mobile garde la couverture paysage. Le
   * `/assets/img/projet/<slug>/cover-portrait.jpg` (voir la convention de nom
   * `projet-<slug>-cover-portrait.jpg` pour l'import médiathèque).
   * L'image de partage Open Graph reste `public/assets/img/og/<slug>.jpg`,
   * en 1200×630, et ignore ce champ.
   */
  coverPortrait?: ProjectImage;
  images: ProjectImage[];
  tags: string[];
  tone: "paper" | "tint" | "dark";
};

/** Couverture d'un projet : visuel dédié s'il existe, sinon la première image de la galerie. */
export function coverOf(project: Project): ProjectImage | undefined {
  return project.cover ?? project.images[0];
}

/**
 * Point de rupture sous lequel la couverture portrait remplace la paysage.
 *
 * Il est déclaré ici pour que le rendu (`<source media=…>`) et les tests
 * lisent la même valeur. 720 px couvre les téléphones en portrait et laisse
 * les tablettes en paysage sur la couverture d'origine.
 */
export const COVER_PORTRAIT_MEDIA = "(max-width: 720px)";

export type CoverOrientation = "landscape" | "portrait";

/**
 * Couverture à servir selon l'orientation de l'écran.
 *
 * `portrait` privilégie `coverPortrait`, puis retombe sur `cover`, puis sur la
 * première image de la galerie : un projet qui n'a pas encore reçu son visuel
 * mobile continue de s'afficher normalement. `landscape` suit `coverOf` à
 * l'identique, donc les appelants existants ne changent pas de comportement.
 */
export function coverFor(
  project: Project,
  orientation: CoverOrientation = "landscape",
): ProjectImage | undefined {
  if (orientation === "portrait") return project.coverPortrait ?? coverOf(project);
  return coverOf(project);
}

export const projects: Project[] = [
  {
    slug: "club-med",
    index: "01",
    name: "Club Med — TEd",
    client: "Club Med",
    year: "2018",
    disciplines: ["Direction artistique", "Design de présentation"],
    pitch:
      "Un événement sur les expériences de voyage, et un lettrage à construire : les trois lettres de TEd deviennent chacune une destination. Une plage, une pente de ski, un désert.",
    scope: "Lettrage photographique, système de présentation, déclinaisons de diapositives",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Trois lettres, trois voyages",
        paragraphs: [
          "Pour l’événement Travel Experience Designer de Club Med, le sujet n’était pas de photographier des vacances, mais de montrer la variété des expériences que la marque revendique. Le brief tenait en un signe : TEd, les trois lettres de l’événement.",
          "La difficulté était double. Il fallait rester reconnaissable à l’intérieur d’une marque très identifiée, son bleu et son trident, sans produire une énième diapositive de catalogue.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Le lettrage comme grille",
        paragraphs: [
          "Chaque lettre devient une fenêtre : le T ouvre sur une plage et une baigneuse face à la mer, le e contient un skieur en pleine descente, le d montre un dromadaire et des pyramides. Le lettrage n’est plus un titre, c’est le sommaire des expériences.",
        ],
        bullets: [
          "Trois photos découpées dans les contre-formes du T, du e et du d, sur un bleu marine qui tient le tout",
          "Un panneau blanc central qui isole le contenu et laisse le voyage occuper les bords",
          "Une typographie sans empattement, un titre en trois lignes, aucune fioriture à côté du trident",
          "Un jeu de diapositives complet : couverture, piliers, page équipe, indicateurs, visuel d’ouverture",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Un système, pas une affiche",
        paragraphs: [
          "Le lettrage a servi de matrice au reste du gabarit : la même logique de photos glissées dans une forme se retrouve sur la couverture, les pages équipe et le visuel d’ouverture. Une direction artistique qui tient sur une diapositive comme sur vingt, et qui reste lisible quand on la réduit.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/club-med/cover.jpg",
      alt: "Plage turquoise et logo Club Med, ouverture du système TEd",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/club-med/02.jpg",
        alt: "Le lettrage TEd : chaque lettre contient une expérience, plage, ski et désert, avec le logotype Club Med",
        width: 2400,
        height: 1350,
      },
      {
        src: "/assets/img/projet/club-med/01.jpg",
        alt: "Couverture de la présentation Club Med : le chiffre 50 en collage de photos de voyage, sur une plage turquoise",
        width: 2400,
        height: 1830,
      },
      {
        src: "/assets/img/projet/club-med/05.jpg",
        alt: "Le jeu de diapositives déployé en perspective : couverture, piliers, indicateurs et pages équipe",
        width: 2400,
        height: 1350,
      },
      {
        src: "/assets/img/projet/club-med/04.jpg",
        alt: "Page équipe du gabarit Club Med, portraits façon Polaroid sur fond de plage",
        width: 2400,
        height: 1350,
      },
      {
        src: "/assets/img/projet/club-med/06.jpg",
        alt: "Visuel d’ouverture estival : van, palmier, avion et slogan Let’s travel",
        width: 2400,
        height: 1350,
      },
    ],
    tags: ["Direction artistique", "Présentation"],
    tone: "tint",
  },
  {
    slug: "saft-energy-storage",
    index: "02",
    name: "Saft, Energy Storage",
    client: "Saft, groupe Total",
    year: "2017",
    disciplines: ["Jeu web", "Interface", "Illustration"],
    pitch:
      "Rendre ludique un sujet industriel : le stockage d’énergie. Un jeu web de salon, jouable debout, pour tenir un stand toute la journée.",
    scope: "Concept de jeu, écran d’accueil, parcours de partie, habillage graphique",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Expliquer l’énergie en deux minutes",
        paragraphs: [
          "Saft et Total voulaient expliquer le stockage d’énergie sur un stand, à un public de passage. Une plaquette ne fonctionne pas dans ce contexte : il faut une accroche en trois secondes et une partie qui tient en deux minutes.",
          "Le vocabulaire technique est un obstacle, y compris pour un public professionnel.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Un super-héros avant un schéma",
        paragraphs: [
          "Le jeu engage par le choix du personnage, puis amène les notions d’énergie par la partie.",
        ],
        bullets: [
          "Un écran d’accueil qui pose le thème en une image : montagnes, éoliennes, panneaux solaires",
          "Un choix de super-héros comme première interaction",
          "Un habillage cartoon en aplat, lisible à distance et rapide à produire",
          "Le bleu pour l’énergie, le rouge réservé au bouton de départ",
          "Des règles accessibles sans quitter la partie",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Une accroche qui tient debout",
        paragraphs: [
          "Le jeu donne une porte d’entrée au sujet sans passer par un discours technique, et reste jouable sans accompagnement sur le stand.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/saft-energy-storage/cover.jpg",
      alt: "Super-héros du jeu Energy Storage, Saft a Total Company",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/saft-energy-storage/01.jpg",
        alt: "Écran d’accueil du jeu Saft Energy Storage, The Game Changer",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/saft-energy-storage/02.jpg",
        alt: "Choix du personnage dans le jeu Saft Energy Storage",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/saft-energy-storage/03.jpg",
        alt: "Écran de jeu Saft Energy Storage",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/saft-energy-storage/04.jpg",
        alt: "Habillage graphique du jeu Saft Energy Storage",
        width: 1920,
        height: 1080,
      },
    ],
    tags: ["Jeu web", "Illustration", "Événementiel"],
    tone: "dark",
  },
  {
    slug: "lg-sales-talk",
    index: "03",
    name: "LG Sales talk",
    client: "LG",
    year: "2017",
    disciplines: ["Application mobile", "UI"],
    pitch:
      "Une application pour les vendeurs en magasin : retrouver une référence, sortir l’argument technique juste, sans quitter le client des yeux.",
    scope: "Parcours vendeur, fiche produit, argumentaire, maquette et prototype",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Répondre en trente secondes",
        paragraphs: [
          "En rayon, le vendeur doit répondre sur la capacité, le cycle, la technologie du moteur. Les fiches PDF et les formations ne sont pas consultables dans ce moment-là.",
          "L’application devait tenir dans une main, avec une hiérarchie qui met l’argument commercial avant la fiche technique.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "L’argument avant la fiche",
        paragraphs: [
          "Un parcours court, construit autour de la référence produit et de ce que le vendeur doit dire au client.",
        ],
        bullets: [
          "Un écran d’entrée par référence, avec photo, modèle et bouton de fiche technique",
          "Des cartes d’arguments dépliables, une par technologie, hiérarchisées par un signe plus ou moins",
          "Une navigation basse à cinq entrées, accessible au pouce",
          "Un prototype Figma pour tester le parcours avant développement",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Un support de vente, pas un catalogue",
        paragraphs: [
          "Le vendeur garde la fiche technique à portée de main sans tourner le dos au client, et l’argument principal reste visible en un écran.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/lg-sales-talk/cover.jpg",
      alt: "Femme vue à travers le hublot d'une machine à laver LG",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/lg-sales-talk/01.jpg",
        alt: "Application LG Sales talk présentée sur un smartphone",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/lg-sales-talk/02.jpg",
        alt: "Écran de fiche technique LG Sales talk",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/lg-sales-talk/03.jpg",
        alt: "Écran d’arguments produit LG Sales talk",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/lg-sales-talk/04.jpg",
        alt: "Navigation et parcours dans LG Sales talk",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/lg-sales-talk/05.jpg",
        alt: "Vue d’ensemble de l’application LG Sales talk",
        width: 1920,
        height: 1080,
      },
    ],
    tags: ["Application mobile", "UI", "Prototype"],
    tone: "dark",
  },
  {
    slug: "dekra",
    index: "04",
    name: "Dekra",
    client: "DEKRA, pour la Ville de Laval",
    year: "2018",
    disciplines: ["Présentation", "Direction artistique"],
    pitch:
      "Une présentation de rendez-vous stratégique pour une ville qui doit attirer des jeunes familles et préparer sa croissance. Le support devait rester lisible à six mètres et tenir debout face à un comité.",
    scope: "Système de diapositives, hiérarchie typographique, mise en page des objectifs",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Poser le contexte en quelques minutes",
        paragraphs: [
          "DEKRA accompagne la Ville de Laval sur un projet urbain. Le rendez-vous inaugural devait poser le contexte et les objectifs devant un auditoire mixte : élus, services techniques, partenaires.",
          "Le risque classique de ce format, c’est la diapositive qui récapitule tout et que personne ne lit.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Un système construit pour être projeté",
        paragraphs: [
          "Chaque diapositive porte un seul objectif, formulé en une phrase, et la mise en page reste identique d’un bout à l’autre.",
        ],
        bullets: [
          "Un écran divisé en deux : la ville en photographie à gauche, la démonstration graphique à droite",
          "Le vert DEKRA comme seule couleur d’accent, sur fond anthracite",
          "Un objectif par diapositive, avec un pictogramme de flèches",
          "Une hiérarchie de titres constante, lisible même sans commentaire oral",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Une base commune pour la suite",
        paragraphs: [
          "Le support a servi de référence pour la suite du projet : chaque intervenant a repris les mêmes gabarits pour ses propres slides.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/dekra/cover.jpg",
      alt: "Conductrice souriante, campagne Drive with confidence de DEKRA",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/dekra/01.jpg",
        alt: "Diapositive DEKRA : contexte et objectifs du rendez-vous pour la Ville de Laval",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/dekra/02.jpg",
        alt: "Diapositive DEKRA, déclinaison du système graphique",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/dekra/03.jpg",
        alt: "Diapositive DEKRA, mise en page des objectifs",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/dekra/04.jpg",
        alt: "Diapositive DEKRA, vue d’ensemble de la présentation",
        width: 1920,
        height: 1080,
      },
    ],
    tags: ["Présentation", "Direction artistique"],
    tone: "paper",
  },
  {
    slug: "analog-way",
    index: "05",
    name: "Analog Way",
    client: "Analog Way SAS",
    year: "2016",
    disciplines: ["Site web", "Design system"],
    pitch:
      "Un fabricant de matériel broadcast qui vend des machines complexes à des intégrateurs. Un site pour trouver le bon boîtier en trois clics.",
    scope: "Arborescence, navigation, gabarits produits, système typographique",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Un catalogue qui ne se laissait pas parcourir",
        paragraphs: [
          "Analog Way conçoit des mélangeurs, convertisseurs et contrôleurs vidéo pour le spectacle et l’intégration. La gamme compte plusieurs familles, des dizaines de références et des noms techniques (Ascender 48, NeXtage 16, VIO 4K) qui ne parlent qu’aux initiés.",
          "Le site précédent présentait l’entreprise. Il ne permettait pas de comparer deux produits, ni de comprendre à quelle famille appartenait une référence croisée dans un appel d’offres.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Un outil de sélection, pas une brochure",
        paragraphs: [
          "Nous avons organisé le site autour de la recherche produit, avec quatre chemins vers le même catalogue et un système typographique unique.",
        ],
        bullets: [
          "Une navigation plein écran qui expose les six entrées du site et les actualités produit",
          "Un sélecteur de langue par continent, avec la carte du monde comme interface",
          "Une page Products qui propose lien rapide, suggestion, filtre technique et famille de produit",
          "Une fiche produit longue : connectiques, téléchargements, vidéos et schéma de flux",
          "Une planche typographique unique, Open Sans en trois niveaux, appliquée à tous les gabarits",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "La gamme se lit sur une page",
        paragraphs: [
          "La hiérarchie des familles est visible d’un écran, et la fiche produit répond aux questions d’installation avant l’appel commercial.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/analog-way/cover.jpg",
      alt: "Processeur Ascender 48 devant le site Analog Way, InfoComm 2015",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/analog-way/01.jpg",
        alt: "Page d’accueil du site Analog Way, actualité InfoComm 2015 et VIO 4K",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/analog-way/02.jpg",
        alt: "Menu de navigation plein écran du site Analog Way",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/analog-way/04.jpg",
        alt: "Système typographique et écran de recherche produit",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/analog-way/05.jpg",
        alt: "Page Products avec filtres, suggestions et familles de produits",
        width: 1920,
        height: 2171,
      },
      {
        src: "/assets/img/projet/analog-way/06.jpg",
        alt: "Fiche produit Ascender 48 LiveCore, caractéristiques et schéma de flux",
        width: 1920,
        height: 4458,
      },
    ],
    tags: ["Site web", "Design system", "Gabarits produits"],
    tone: "dark",
  },
  {
    slug: "evenement-spectacle",
    index: "06",
    name: "L’Événement Spectacle",
    client: "L’Événement Spectacle",
    year: "2020",
    disciplines: ["Site web", "Interface"],
    pitch:
      "Un prestataire événementiel qui vend deux univers très différents : l’arbre de Noël d’entreprise et la soirée cabaret. Le site devait les faire cohabiter sans que l’un mange l’autre.",
    scope: "Architecture de l’information, page d’accueil, modules de réservation",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Deux univers, une seule page",
        paragraphs: [
          "Les clients arrivent avec une demande déjà formée : un arbre de Noël pour cent personnes, ou une soirée sur mesure. Le site devait répondre en une page, avec le ton de chaque univers, sans mélanger les codes.",
          "Le catalogue est large : billetterie, formule à la carte, goûters, cocktails, services complémentaires.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Deux blocs assumés",
        paragraphs: [
          "L’accueil sépare les deux offres au lieu de les fondre dans un discours unique.",
        ],
        bullets: [
          "Esprit de Noël à gauche, cabaret à droite, chacun avec sa typographie et son imagerie",
          "Des pastilles de service qui ouvrent directement la bonne formule",
          "Une barre de navigation basse : présentation, témoignages, recherche",
          "Le rouge comme seule couleur d’action, pour garder le chemin de réservation évident",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Chaque visiteur trouve son univers",
        paragraphs: [
          "Le visiteur choisit son univers dès le premier écran, et le parcours de réservation reste identique d’un côté à l’autre.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/evenement-spectacle/cover.jpg",
      alt: "Danseuse en jupe rouge sur l'accueil de L'Événement Spectacle",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/evenement-spectacle/01.jpg",
        alt: "Page d’accueil L’Événement Spectacle, arbre de Noël et soirées cabaret",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/evenement-spectacle/02.jpg",
        alt: "Interface L’Événement Spectacle, formule arbre de Noël",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/evenement-spectacle/03.jpg",
        alt: "Interface L’Événement Spectacle, soirées et réservation",
        width: 1920,
        height: 1080,
      },
    ],
    tags: ["Site web", "Interface", "Événementiel"],
    tone: "tint",
  },
  {
    slug: "elerya",
    index: "07",
    name: "Elerya",
    client: "Elerya",
    year: "2024",
    disciplines: ["Identité", "Direction photo", "E-commerce"],
    pitch:
      "Une marque de maroquinerie qui devait paraître installée dès le premier visuel, sans budget de campagne. Tout tient au cadrage et à la matière.",
    scope: "Logotype, système typographique, direction photo produit, gabarits e-commerce",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "La qualité se joue avant le prix",
        paragraphs: [
          "Elerya lance une ligne de sacs en cuir. Sur ce marché, la perception de qualité se joue avant le prix : dans la photo, dans la typographie, dans la cohérence entre la fiche produit et le logo imprimé.",
          "La marque n’avait ni charte, ni bibliothèque d’images, ni gabarit pour ses fiches.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Le produit comme seul sujet",
        paragraphs: [
          "Une identité courte, construite pour survivre au petit format et au fond photographique.",
        ],
        bullets: [
          "Un logotype serif en capitales, avec un Y dessiné qui devient un signe reconnaissable",
          "Une palette de trois teintes : cognac, crème, laiton",
          "Une direction photo studio, fond neutre, produit suspendu, ombre douce",
          "Des gabarits e-commerce qui réservent un bloc plein pour l’appel à l’action",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Une bibliothèque réutilisable",
        paragraphs: [
          "La marque dispose d’un jeu d’images et de règles qui tient sur le site, les réseaux et les fiches revendeurs, avec le même cadrage et la même hiérarchie.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/elerya/cover.jpg",
      alt: "Sac Elerya porté en extérieur, direction photo de la collection",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/elerya/01.jpg",
        alt: "Sac Elerya en cuir cognac sur fond crème, logotype en arrière-plan",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/elerya/02.jpg",
        alt: "Détail du logotype Elerya et de la matière du cuir",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/elerya/03.jpg",
        alt: "Visuel produit Elerya en studio",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/elerya/04.jpg",
        alt: "Déclinaison Elerya sur un gabarit e-commerce",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/elerya/06.jpg",
        alt: "Mise en situation du sac Elerya",
        width: 1920,
        height: 1080,
      },
    ],
    tags: ["Identité", "Direction photo", "E-commerce"],
    tone: "tint",
  },
  {
    slug: "logofolio",
    index: "08",
    name: "Logofolio 2013 — 2017",
    client: "Sélection de marques",
    year: "2013 — 2017",
    disciplines: ["Identité", "Logotypes"],
    pitch:
      "Des logotypes réalisés entre 2013 et 2017, chacun sur sa planche : le signe, et le contexte de la marque quand il existe.",
    scope: "Création de logotypes et déclinaisons",
    cover: {
      src: "/assets/img/projet/logofolio/cover.jpg",
      alt: "Couverture du Logofolio 2013 — 2017, collage de logotypes en noir et blanc",
      width: 1920,
      height: 1280,
    },
    coverPortrait: {
      src: "/assets/img/projet/logofolio/cover-portrait.jpg",
      alt: "Collage de logotypes du Logofolio en noir et blanc",
      width: 1080,
      height: 1920,
    },
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Comparer les signes, pas les décors",
        paragraphs: [
          "Une collection de logotypes réalisés entre 2013 et 2017 pour des clients de secteurs différents : maison de retraite, fruits, événementiel, danse, logistique, automobile, conseil, service premium.",
          "Réunis sur une même planche, ils révèlent une constante : des signes construits sur une géométrie simple, lisibles en petit.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Un cadre constant",
        paragraphs: [
          "La présentation s’efface derrière les signes : le logotype à gauche sur fond blanc, la mise en situation à droite, une marque par planche.",
        ],
        bullets: [
          "Une couverture qui assemble les visuels de la collection",
          "Une planche par marque : le signe à gauche, la photographie à droite",
          "Des déclinaisons montrées en situation quand le signe le supporte",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Huit identités, une méthode",
        paragraphs: [
          "Le Village d’Angervilliers, FruiZi, NS Events, Avatharam, Demethon, Noisy Automobiles, Nine Brains et Asta : huit identités nommées, présentées selon les mêmes règles.",
        ],
      },
    ],
    images: [
      {
        src: "/assets/img/projet/logofolio/01.jpg",
        alt: "Le Village d’Angervilliers, logotype et couple photographié",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/logofolio/02.jpg",
        alt: "FruiZi, logotype et jeune femme souriante",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/logofolio/03.jpg",
        alt: "NS Events, logotype et décor de cérémonie",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/logofolio/04.jpg",
        alt: "Avatharam, logotype et danseuse en mouvement",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/logofolio/05.jpg",
        alt: "Demethon, logotype et livreurs dans un camion",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/logofolio/06.jpg",
        alt: "Noisy Automobiles, logotype et mécanicien à l’atelier",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/logofolio/07.jpg",
        alt: "Nine Brains, logotype et photo d’équipe",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/logofolio/08.jpg",
        alt: "Asta, logotype et femme montant dans une voiture avec chauffeur",
        width: 1920,
        height: 1080,
      },
    ],
    tags: ["Identité", "Logotypes"],
    tone: "paper",
  },
  {
    slug: "american-steak-house",
    index: "09",
    name: "American Steak House",
    client: "American Steak House",
    year: "2017",
    city: "Saint-Brice-sous-Forêt",
    disciplines: ["Identité", "Édition", "Réseaux sociaux"],
    pitch:
      "Un steakhouse qui ouvre à Saint-Brice avec un univers western assumé. Une identité qui tient sur une carte noire, une façade et un post.",
    scope:
      "Logotype, charte typographique, carte et menu bilingue, affichage en restaurant, posts réseaux sociaux",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "La marque avant la première table",
        paragraphs: [
          "American Steak House arrive à Saint-Brice-sous-Forêt avec une carte de viandes d’exception : Wagyu, Black Angus USA, Argentine, Salers, charcuteries fines, vins et bières.",
          "Tout est à construire avant l’ouverture : le nom est long, la carte doit être bilingue, et la façade doit exister avant la première réservation.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Trois couleurs, un seul accent",
        paragraphs: [
          "Un univers western tenu par un principe simple : noir et blanc pour l’image, le rouge réservé au signe.",
        ],
        bullets: [
          "Un logotype au taureau et à l’étoile, lisible du premier coup d’œil",
          "Indiana, une display western, pour toute la hiérarchie du nom",
          "Photo noir et blanc pour l’univers, rouge unique pour le repère de marque",
          "Une carte noire bilingue, avec un bloc rouge par famille de plats",
          "Les mêmes règles reportées sur l’affichage restaurant et les posts d’annonce",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "La marque tient dans la salle",
        paragraphs: [
          "Le logotype, la carte, l’affichage et les posts partagent la même typographie et le même rouge. La marque est lisible sur une carte posée sur une table comme sur une annonce d’ouverture.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/american-steak-house/cover.jpg",
      alt: "Logo American Steak House sur une photo de bétail Highland au ranch",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/american-steak-house/01.jpg",
        alt: "Bannière American Steak House, logo sur une photo de ranch",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/american-steak-house/02.jpg",
        alt: "Planche typographique Indiana Regular appliquée au logotype",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/american-steak-house/03.jpg",
        alt: "Couverture de carte American Steak House, côte de bœuf sur le grill",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/american-steak-house/04.jpg",
        alt: "Double page de la carte, viandes, burgers et bières",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/american-steak-house/05.jpg",
        alt: "Réglage du crénage du logotype dans Illustrator",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/american-steak-house/06.jpg",
        alt: "Visuel de marque, cow-boy et titre STEAKHOUSE",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/american-steak-house/07.jpg",
        alt: "Logotype American Steak House, taureau rouge et étoile sur fond blanc",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/american-steak-house/08.jpg",
        alt: "Post d'annonce, côte de bœuf au barbecue, ouverture à Saint-Brice",
        width: 1920,
        height: 1080,
      },
    ],
    tags: ["Identité", "Édition", "Social"],
    tone: "dark",
  },
  {
    slug: "le-kolam",
    index: "10",
    name: "Le Kolam",
    client: "Le Kolam",
    year: "2017",
    city: "Val d’Europe",
    disciplines: ["Direction artistique", "Identité", "Édition"],
    pitch:
      "Une identité indienne complète, du plan de salle au site : un motif kolam décliné sur la carte, la vitrine et les murs.",
    scope:
      "Direction artistique, plans d’aménagement de la salle, communication d’ouverture, carte, affichage boutique, design mural, réseaux sociaux, site internet",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Tout à faire avant l’ouverture",
        paragraphs: [
          "Le Kolam ouvre en 2017 avec une cuisine indienne et une salle encore vide. Il n’y a ni identité, ni carte, ni vitrine, ni site, et l’ouverture impose de traiter les quatre en même temps.",
          "La direction artistique couvre donc le projet de bout en bout : le nom et son motif, l’aménagement de la salle, les supports imprimés, l’affichage, le mur et la communication.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Un motif qui tient partout",
        paragraphs: [
          "Le kolam, dessin traditionnel au sol, devient la colonne vertébrale de la marque : un signe simple, répétable à toutes les échelles, du logotype au mur peint.",
        ],
        bullets: [
          "Un logotype construit sur un motif à quatre boucles et points, lisible en petit",
          "Le motif décliné en fond de carte, d’affichage boutique et de design mural",
          "Une carte illustrée qui rattache chaque plat à sa région, du Pendjab au Népal",
          "Des plans d’aménagement de la salle : circulation, zones de service, place du bar",
          "Une communication d’ouverture et des publications régulières sur les réseaux",
          "Un site internet posé en même temps que l’ouverture, pour exister dès le premier service",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Une seule direction, du plan de salle au menu",
        paragraphs: [
          "Le motif, la typographie et la photographie se répondent de la façade au menu. La salle, la carte et les publications racontent la même cuisine, sans rupture entre le lieu et sa communication.",
        ],
      },
    ],
    cover: {
      src: "/assets/img/projet/le-kolam/cover.jpg",
      alt: "Plat Le Kolam, curry et riz dans une poêle en fonte sur fond noir",
      width: 1920,
      height: 1280,
    },
    images: [
      {
        src: "/assets/img/projet/le-kolam/01.jpg",
        alt: "Logotype Le Kolam sur un fond de motifs kolam",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/02.jpg",
        alt: "Couverture de carte Le Kolam, motif kolam et titre",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/03.jpg",
        alt: "Planche de références, motifs traditionnels, Pakistan et Chine",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/04.jpg",
        alt: "Le site Le Kolam, photo de curry et carte illustrée de l’Inde",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/05.jpg",
        alt: "Page d’annonce du site, ouverture au Clos du Chêne, Val d’Europe",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/06.jpg",
        alt: "Six plats de la carte présentés sur fond noir",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/07.jpg",
        alt: "Fiches épices, curcuma, cardamome et cumin",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/08.jpg",
        alt: "Perspectives 3D de l’aménagement de la salle",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/09.jpg",
        alt: "Double page de la carte consacrée aux pains indiens",
        width: 1920,
        height: 1080,
      },
      {
        src: "/assets/img/projet/le-kolam/10.jpg",
        alt: "Affiche d’annonce du buffet indien sur un mur",
        width: 1920,
        height: 1080,
      },
    ],
    tags: ["Direction artistique", "Identité", "Web"],
    tone: "dark",
  },
  {
    slug: "societe-generale-voeux-2018",
    index: "11",
    name: "Vœux Société Générale",
    client: "Société Générale",
    year: "2017",
    disciplines: ["Direction artistique", "Motion design"],
    pitch:
      "Deux films de vœux 2018 pour la Société Générale, écrits à partir d’œuvres de sa collection : scénario, direction artistique et animation sur After Effects.",
    scope: "Scénario, storyboard, direction artistique, animation After Effects, cartons de crédits",
    duration: "2 films de 25 s",
    cover: {
      src: "/assets/img/projet/societe-generale-voeux-2018/cover.jpg",
      alt: "Le logotype Société Générale au centre d’un cercle gris traversé par un croissant doré",
      width: 1920,
      height: 1280,
    },
    coverPortrait: {
      src: "/assets/img/projet/societe-generale-voeux-2018/cover-portrait.jpg",
      alt: "Le logotype Société Générale entouré d’un cercle gris et d’un croissant doré, cadrage vertical",
      width: 1080,
      height: 1920,
    },
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Deux œuvres sorties du cadre",
        paragraphs: [
          "Pour les vœux 2018, la direction de la Société Générale a retenu deux pièces de la collection du groupe : Cercles, huile sur toile de Geneviève Claisse peinte en 1968, et une toile sans titre de Louis Granet.",
          "Deux mondes très différents, la géométrie dure et colorée de l’une, le trait doré et les fleurs de l’autre, pour un même format de sortie : deux films de vingt-cinq secondes.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Mettre en mouvement sans trahir",
        paragraphs: [
          "Chaque film suit la même partition : la date qui s’installe, le motif qui se déploie, les vœux en plusieurs langues, puis le retour à l’œuvre et à ses crédits.",
          "Chez Claisse, les cercles deviennent un mécanisme, les disques glissent et se recouvrent sur une palette réduite, avec une typographie dorée. Chez Granet, le dessin au trait pousse comme un branchage avant de laisser la toile occuper l’écran.",
        ],
        bullets: [
          "Scénario, storyboard et direction artistique de chaque film",
          "Animation, compositing et habillage sur After Effects",
          "Cartons de crédits et signature Société Générale en fin de film",
          "Deux films de 25 secondes au format 16/9",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "L’œuvre reste le sujet",
        paragraphs: [
          "Le mouvement ne sert pas d’effet : il guide la lecture, de la date aux vœux, puis au crédit de l’artiste. Le spectateur voit une œuvre de la collection, pas une publicité.",
          "Deux films, une même écriture, où la marque s’efface derrière ce qu’elle a choisi de montrer.",
        ],
      },
    ],
    images: [],
    tags: ["Direction artistique", "Motion design", "Animation"],
    tone: "paper",
  },
];

export const projectSlugs = projects.map((project) => project.slug);

export function getProject(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug);
}

export function nextProject(slug: string): Project {
  const index = projects.findIndex((project) => project.slug === slug);
  return projects[(index + 1) % projects.length] ?? projects[0]!;
}
