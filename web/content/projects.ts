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
  images: ProjectImage[];
  tags: string[];
  tone: "paper" | "tint" | "dark";
};

export const projects: Project[] = [
  {
    slug: "elerya",
    index: "01",
    name: "Elerya",
    client: "Elerya",
    disciplines: ["Identité", "Direction photo", "E-commerce"],
    pitch:
      "Une marque de maroquinerie qui devait paraître installée dès le premier visuel, sans budget de campagne. Tout repose sur le cadrage, la matière et un logotype qui tient sur une étiquette cousue.",
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
    images: [
      {
        src: "/assets/img/projet/elerya/01.jpg",
        alt: "Sac Elerya en cuir cognac sur fond crème, logotype en arrière-plan",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/elerya/02.jpg",
        alt: "Détail du logotype Elerya et de la matière du cuir",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/elerya/03.jpg",
        alt: "Visuel produit Elerya en studio",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/elerya/04.jpg",
        alt: "Déclinaison Elerya sur un gabarit e-commerce",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/elerya/06.jpg",
        alt: "Mise en situation du sac Elerya",
        width: 1600,
        height: 900,
      },
    ],
    tags: ["Identité", "Direction photo", "E-commerce"],
    tone: "tint",
  },
  {
    slug: "analog-way",
    index: "02",
    name: "Analog Way",
    client: "Analog Way SAS",
    year: "2016",
    disciplines: ["Site web", "Design system"],
    pitch:
      "Un fabricant de matériel broadcast qui vend des machines complexes à des intégrateurs. Le site devait tenir la promesse du produit : trouver le bon boîtier en trois clics, sans noyer l’utilisateur sous les références.",
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
    images: [
      {
        src: "/assets/img/projet/analog-way/01.jpg",
        alt: "Page d’accueil du site Analog Way, actualité InfoComm 2015 et VIO 4K",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/analog-way/02.jpg",
        alt: "Menu de navigation plein écran du site Analog Way",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/analog-way/04.jpg",
        alt: "Système typographique et écran de recherche produit",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/analog-way/05.jpg",
        alt: "Page Products avec filtres, suggestions et familles de produits",
        width: 1600,
        height: 1809,
      },
      {
        src: "/assets/img/projet/analog-way/06.jpg",
        alt: "Fiche produit Ascender 48 LiveCore, caractéristiques et schéma de flux",
        width: 1600,
        height: 3715,
      },
    ],
    tags: ["Site web", "Design system", "Gabarits produits"],
    tone: "dark",
  },
  {
    slug: "dekra",
    index: "03",
    name: "Dekra",
    client: "DEKRA, pour la Ville de Laval",
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
    images: [
      {
        src: "/assets/img/projet/dekra/01.jpg",
        alt: "Diapositive DEKRA : contexte et objectifs du rendez-vous pour la Ville de Laval",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/dekra/02.jpg",
        alt: "Diapositive DEKRA, déclinaison du système graphique",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/dekra/03.jpg",
        alt: "Diapositive DEKRA, mise en page des objectifs",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/dekra/04.jpg",
        alt: "Diapositive DEKRA, vue d’ensemble de la présentation",
        width: 1600,
        height: 900,
      },
    ],
    tags: ["Présentation", "Direction artistique"],
    tone: "paper",
  },
  {
    slug: "lg-sales-talk",
    index: "04",
    name: "LG Sales talk",
    client: "LG",
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
    images: [
      {
        src: "/assets/img/projet/lg-sales-talk/01.jpg",
        alt: "Application LG Sales talk présentée sur un smartphone",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/lg-sales-talk/02.jpg",
        alt: "Écran de fiche technique LG Sales talk",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/lg-sales-talk/03.jpg",
        alt: "Écran d’arguments produit LG Sales talk",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/lg-sales-talk/04.jpg",
        alt: "Navigation et parcours dans LG Sales talk",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/lg-sales-talk/05.jpg",
        alt: "Vue d’ensemble de l’application LG Sales talk",
        width: 1600,
        height: 900,
      },
    ],
    tags: ["Application mobile", "UI", "Prototype"],
    tone: "dark",
  },
  {
    slug: "evenement-spectacle",
    index: "05",
    name: "L’Événement Spectacle",
    client: "L’Événement Spectacle",
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
    images: [
      {
        src: "/assets/img/projet/evenement-spectacle/01.jpg",
        alt: "Page d’accueil L’Événement Spectacle, arbre de Noël et soirées cabaret",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/evenement-spectacle/02.jpg",
        alt: "Interface L’Événement Spectacle, formule arbre de Noël",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/evenement-spectacle/03.jpg",
        alt: "Interface L’Événement Spectacle, soirées et réservation",
        width: 1600,
        height: 900,
      },
    ],
    tags: ["Site web", "Interface", "Événementiel"],
    tone: "tint",
  },
  {
    slug: "saft-energy-storage",
    index: "06",
    name: "Saft, Energy Storage",
    client: "Saft, groupe Total",
    year: "2015",
    disciplines: ["Jeu web", "Interface", "Illustration"],
    pitch:
      "Rendre ludique un sujet industriel : le stockage d’énergie. Un jeu web de salon, jouable debout, sur un écran d’événement.",
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
    images: [
      {
        src: "/assets/img/projet/saft-energy-storage/01.jpg",
        alt: "Écran d’accueil du jeu Saft Energy Storage, The Game Changer",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/saft-energy-storage/02.jpg",
        alt: "Choix du personnage dans le jeu Saft Energy Storage",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/saft-energy-storage/03.jpg",
        alt: "Écran de jeu Saft Energy Storage",
        width: 1600,
        height: 900,
      },
      {
        src: "/assets/img/projet/saft-energy-storage/04.jpg",
        alt: "Habillage graphique du jeu Saft Energy Storage",
        width: 1600,
        height: 900,
      },
    ],
    tags: ["Jeu web", "Illustration", "Événementiel"],
    tone: "dark",
  },
  {
    slug: "logofolio",
    index: "07",
    name: "Logofolio 2013 — 2017",
    client: "Sélection de marques",
    year: "2013 — 2017",
    disciplines: ["Identité", "Logotypes"],
    pitch:
      "Des logotypes réalisés entre 2013 et 2017, présentés sans mise en scène. La contrainte d’un logofolio, c’est de montrer une méthode sans noyer les signes dans un décor.",
    scope: "Création de logotypes et déclinaisons",
    sections: [
      {
        k: "01",
        label: "Contexte",
        title: "Comparer les signes, pas les décors",
        paragraphs: [
          "Une collection de logotypes réalisés entre 2013 et 2017 pour des clients de secteurs différents : maison d’hôtes, fruits, événementiel, automobile, conseil, transfert d’argent, média.",
          "Réunis sur une même planche, ils révèlent une constante : des signes construits sur une géométrie simple, lisibles en petit.",
        ],
      },
      {
        k: "02",
        label: "Décision",
        title: "Un cadre constant",
        paragraphs: [
          "La présentation s’efface derrière les signes : même fond, même cadrage, une marque par planche.",
        ],
        bullets: [
          "Une couverture typographique, sans logo, pour poser le projet avant la collection",
          "Une planche par marque, fond neutre, un seul signe par cadre",
          "Des déclinaisons montrées en situation quand le signe le supporte",
        ],
      },
      {
        k: "03",
        label: "Résultat",
        title: "Onze identités, une méthode",
        paragraphs: [
          "Maison Angervilier, Fruizi, NS4 Events, Avatharan, Demethon, Noisy Auto, Nine Brains, Asta, CGD Transfert, Yaal Media et Nett1net : onze identités nommées, présentées selon les mêmes règles.",
        ],
      },
    ],
    images: [
      {
        src: "/assets/img/projet/logofolio/01.jpg",
        alt: "Couverture du Logofolio 2013 — 2016",
        width: 1600,
        height: 1040,
      },
      {
        src: "/assets/img/projet/logofolio/03.jpg",
        alt: "Logotype Maison Angervilier",
        width: 1600,
        height: 1040,
      },
      {
        src: "/assets/img/projet/logofolio/04.jpg",
        alt: "Logotype Fruizi",
        width: 1600,
        height: 1040,
      },
      {
        src: "/assets/img/projet/logofolio/05.jpg",
        alt: "Logotype NS4 Events",
        width: 1600,
        height: 1040,
      },
      {
        src: "/assets/img/projet/logofolio/06.jpg",
        alt: "Logotype Avatharan",
        width: 1600,
        height: 1040,
      },
      {
        src: "/assets/img/projet/logofolio/07.jpg",
        alt: "Logotype Demethon",
        width: 1600,
        height: 1040,
      },
      {
        src: "/assets/img/projet/logofolio/08.jpg",
        alt: "Logotype Noisy Auto",
        width: 1600,
        height: 1040,
      },
    ],
    tags: ["Identité", "Logotypes"],
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
