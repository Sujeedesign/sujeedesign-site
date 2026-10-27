import { homeSchema, type HomeContent } from "@/lib/content/schema";
import { mailto, routes } from "@/lib/routes";

/**
 * Contenu de l'accueil, repris mot pour mot du v5.
 *
 * Les liens passent par la table de routes : aucun `.html` en dur.
 */
export const homeContent: HomeContent = homeSchema.parse({
  hero: {
    kicker: "Projet à la une · Vaasam Paris · 2026",
    title: {
      first: "Votre",
      highlight: "marque,",
      last: "de\u00A0A\u00A0à\u00A0Z.",
    },
    lead: {
      text: "Identité, image, web, outils. Je dessine des marques qui tiennent debout partout, ",
      strong: "et je reste jusqu'à ce qu'elles tournent en vrai.",
    },
    cta: { label: "Voir le projet", href: routes.realisations + "/vaasam" },
    tag: "Identité · Packaging · 40 références",
  },
  studio: {
    title: ["Designer indépendant,", "entre Cergy et Paris."],
    intro:
      "Identité, direction artistique, sites. Je travaille seul et en direct, avec des marques qui ont besoin d'un système cohérent, du nom jusqu'à la mise en ligne.",
    aside: "Cergy · Paris · sur rendez-vous",
    statement: {
      text: "Ce que vous voyez ici a été livré. ",
      emphasis: "Rien n'est une maquette de concours.",
    },
    stats: [
      {
        value: "2013",
        label: "Première année",
        text: "Treize ans de pratique indépendante, sans intermédiaire.",
      },
      {
        value: "60+",
        label: "Marques",
        text: "De l'artisan seul à la franchise multi-sites.",
      },
      {
        value: "5",
        label: "Métiers",
        text: "Identité, image, web, contenu, outils IA.",
      },
      {
        value: "48 h",
        label: "Réponse",
        text: "Ouvré, même en pleine production.",
      },
    ],
  },
  cases: {
    title: ["Six projets,", "six systèmes."],
    intro:
      "Chaque marque repart avec ses règles : ce qui se répète, ce qui varie, et ce qu'on ne fait jamais. Trois sont ici, les six sont sur la page Réalisations.",
    aside: { label: "Les six projets ↗", href: routes.realisations },
    items: [
      {
        id: "case01",
        index: "01 / Identité · Packaging",
        meta: ["Vaasam Paris", "40 références", "2026"],
        title: "Vaasam",
        tags: ["Nom", "Logo", "Système typographique", "Packaging"],
        barLabel: "Épicerie fine · Paris",
        ghost: "01",
        visual: "pack",
        tone: "paper",
        href: `${routes.realisations}/vaasam`,
      },
      {
        id: "case02",
        index: "02 / Marque · Web",
        meta: ["RFA", "4 sites", "2025"],
        title: "RFA",
        tags: ["Identité", "Signalétique", "Site", "Déploiement"],
        barLabel: "Restauration · franchise",
        ghost: "02",
        visual: "sign",
        tone: "signal",
        href: `${routes.realisations}/rfa`,
      },
      {
        id: "case03",
        index: "03 / Plateforme · Outils IA",
        meta: ["Atelier 24", "Formation", "2025"],
        title: "Atelier 24",
        tags: ["Interface", "Contenu", "Workflows", "Formation"],
        barLabel: "Formation · automatisation",
        ghost: "03",
        visual: "ui",
        tone: "ui",
        href: `${routes.realisations}/atelier-24`,
      },
    ],
  },
  method: {
    title: "Trois temps, pas de tunnel.",
    intro:
      "Vous savez toujours où on en est, ce qui est attendu de vous, et ce qui vient ensuite.",
    aside: "Cadrer · Concevoir · Livrer",
    steps: [
      {
        step: "Étape 01",
        duration: "1 semaine",
        title: "Cadrer",
        text: "On regarde l'existant, les chiffres et les contraintes réelles. Je repars avec un périmètre écrit. Si le projet n'a pas de sens, je le dis maintenant.",
      },
      {
        step: "Étape 02",
        duration: "2 à 4 semaines",
        title: "Concevoir",
        text: "Deux directions maximum, présentées sur du réel : vos pages, vos supports, vos mots. Pas de maquette vitrine qui s'effondre à la première page intérieure.",
      },
      {
        step: "Étape 03",
        duration: "1 à 3 semaines",
        title: "Livrer",
        text: "Intégration, mise en ligne, documentation et prise en main. Vous repartez autonome, avec les sources et les accès à votre nom.",
      },
    ],
  },
  services: {
    title: ["Cinq métiers,", "un seul interlocuteur."],
    intro:
      "Le périmètre est écrit avant de commencer, les allers-retours sont inclus, la livraison est documentée.",
    aside: "Identité · Image · Web",
    items: [
      {
        number: "01",
        title: "Identité de marque",
        summary: "Nom, logotype, typographie, couleurs, guide d'usage.",
        href: "/services/identite-de-marque",
      },
      {
        number: "02",
        title: "Direction artistique",
        summary: "Print, éditions, campagnes, photographie.",
        href: "/services/direction-artistique",
      },
      {
        number: "03",
        title: "Site & e-commerce",
        summary: "Design, intégration, SEO technique, formation.",
        href: "/services/site-ecommerce",
      },
      {
        number: "04",
        title: "Contenu & réseaux",
        summary: "Ligne éditoriale, gabarits, production régulière.",
        href: "/services/contenu-reseaux",
      },
      {
        number: "05",
        title: "Agents IA",
        summary: "Automatisations, assistants internes, formation.",
        href: "/services/agents-ia",
      },
    ],
  },
  cta: {
    text: "Un projet en tête ? Dites-moi ce que vous vendez et ce qui coince.",
    action: {
      label: "Parlons de votre besoin",
      href: mailto("Un projet à cadrer"),
    },
  },
});
