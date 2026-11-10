import Link from "next/link";
import Faq from "@/components/Faq";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./GuidePrixLogo.module.css";
import { CoverFigure } from "./CoverFigure";

/**
 * Page /guides/prix-site-internet (P7).
 *
 * Même grammaire éditoriale que le guide du logo : bloc « En bref » servi en
 * haut de page et repris en tête du `FAQPage`, sommaire, tableaux, FAQ.
 * Prix du studio issus de la grille appliquée (CRM, 10/11/2026) ; repères de
 * marché exprimés en moyennes, sans citer de prestataire.
 */
export const pageMeta = {
  title: "Combien coûte un site internet en 2026 ?",
  description:
    "Prix d'un site internet en 2026 : site vitrine, e-commerce, refonte, coûts récurrents. Les fourchettes réelles et ce qui fait varier la facture.",
};

export const aeo = {
  question: "Combien coûte un site internet en 2026 ?",
  answer:
    "Un site vitrine se situe entre 1 200 € et 5 000 € selon la technologie et le périmètre. Les prix affichés démarrent autour de 1 200 €, mais les budgets réellement engagés par une TPE tournent en moyenne autour de 4 000 €, car un site utile demande du design, des contenus et de la recette. Une boutique en ligne se situe autour de 2 700 € en forfait, davantage en agence. Ici, un site statique sur mesure coûte 2 000 €, un WordPress 2 750 € et une boutique Shopify 4 000 €. Il faut y ajouter les coûts récurrents : nom de domaine de 5 à 50 € par an, hébergement de 5 à 30 € par mois, maintenance de 30 à 70 € par mois.",
};

export const faqItems = [
  {
    question: "Pourquoi un site à 500 € n'est-il pas comparable à un site à 3 000 € ?",
    answer:
      "Parce que ce n'est pas le même travail. À 500 €, on installe un thème et on remplit quelques pages. À 3 000 €, on conçoit une arborescence, des maquettes, une intégration sur mesure, une recette sur mobile et une base propre pour le référencement. Le premier se refait souvent au bout de deux ans.",
  },
  {
    question: "Faut-il payer un abonnement en plus du site ?",
    answer:
      "Oui, toujours. Le nom de domaine, l'hébergement et les sauvegardes sont des coûts récurrents, indépendants du travail de création. Comptez de 5 à 50 € par an pour le domaine et de 5 à 30 € par mois pour un hébergement correct.",
  },
  {
    question: "Quelle est la différence entre WordPress et un site sur mesure ?",
    answer:
      "WordPress vous laisse la main sur les textes et les images après une courte formation, avec des mises à jour à suivre. Un site statique sur mesure est plus rapide et plus sûr, mais chaque évolution passe par un développeur. Le choix dépend de la fréquence à laquelle vous modifiez vos contenus.",
  },
  {
    question: "Combien de temps prend la création d'un site ?",
    answer:
      "De trois à six semaines pour un site vitrine, de six à douze semaines pour une boutique. Le délai dépend surtout de la date de vos retours et de l'arrivée des contenus, pas du temps de développement seul.",
  },
  {
    question: "Qui écrit les textes du site ?",
    answer:
      "Vous, dans la plupart des cas. La rédaction peut être incluse, mais elle se chiffre à part, et elle change le prix du projet. Un site livré avec des textes provisoires reste un site provisoire.",
  },
  {
    question: "Le référencement est-il compris dans le prix ?",
    answer:
      "Les bases techniques le sont : structure des titres, balises, vitesse, plan du site, données structurées. Le travail éditorial et le suivi de position, eux, sont une prestation séparée, qui se facture au mois ou à la journée.",
  },
  {
    question: "Que se passe-t-il si je change de prestataire ?",
    answer:
      "Le code, le nom de domaine et l'hébergement doivent être à votre nom. C'est le point à écrire noir sur blanc dans le devis : un site dont vous ne détenez pas les accès n'est pas votre site.",
  },
  {
    question: "Un site suffit-il pour être visible sur Google ?",
    answer:
      "Non. Un site permet d'être trouvé, il ne garantit pas de l'être. Il faut du contenu qui répond à des recherches réelles, des pages de service claires et du temps. Aucun prestataire sérieux ne promet une position.",
  },
];

const SOMMAIRE = [
  { href: "#paliers", label: "Les quatre paliers" },
  { href: "#prix", label: "Ce qui fait monter le prix" },
  { href: "#recurrent", label: "Les coûts récurrents" },
  { href: "#marche", label: "Les prix moyens du marché" },
  { href: "#nos-prix", label: "Nos prix" },
  { href: "#temps", label: "Le temps de travail" },
  { href: "#devis", label: "Ce qu'un devis doit contenir" },
  { href: "#faq", label: "Questions" },
];

const PALIERS = [
  {
    fourchette: "500 à 1 200 €",
    produit:
      "Un thème acheté, quelques pages remplies, un formulaire de contact. Parfois suffisant pour exister et tester une activité.",
    manque:
      "L'arborescence pensée pour vos clients, la vitesse, les bases du référencement, la recette sur mobile.",
  },
  {
    fourchette: "1 500 à 3 500 €",
    produit:
      "Un site vitrine sur mesure : cinq à dix pages, une vraie direction visuelle, une intégration propre et une formation pour publier vos contenus.",
    manque:
      "Rien d'essentiel pour une activité de services. Les fonctionnalités spécifiques se chiffrent au-delà.",
  },
  {
    fourchette: "3 500 à 8 000 €",
    produit:
      "Un site avec des fonctionnalités : réservation, catalogue filtrable, espace client, multilingue, parcours de devis.",
    manque:
      "Rien, mais le projet demande un cadrage écrit et des allers-retours suivis : le périmètre doit être verrouillé avant de commencer.",
  },
  {
    fourchette: "10 000 € et plus",
    produit:
      "Une boutique importante, une refonte de site existant avec migration, ou un projet d'agence avec plusieurs intervenants.",
    manque:
      "Rien, sauf la clarté : à ce niveau, ce qui coûte cher n'est pas le développement mais les décisions mal prises en amont.",
  },
];

const FACTEURS = [
  {
    titre: "Le nombre de modèles de pages",
    texte:
      "Un site de cinq pages n'a pas le même coût qu'un site de vingt pages. Ce qui compte n'est pas le nombre de pages mais le nombre de modèles distincts à concevoir : accueil, page service, étude de cas, article, contact.",
  },
  {
    titre: "Le design, sur mesure ou non",
    texte:
      "Un thème adapté demande quelques heures. Une direction visuelle dessinée pour votre marque demande des maquettes, des allers-retours et une intégration fidèle. C'est le premier poste d'écart entre 1 500 et 5 000 €.",
  },
  {
    titre: "Les contenus",
    texte:
      "Textes, photos, vidéos, traductions. Quand ils arrivent prêts, le projet avance. Quand il faut les produire, cela devient un projet dans le projet, et c'est souvent la ligne oubliée du devis.",
  },
  {
    titre: "Les fonctionnalités",
    texte:
      "Réservation, paiement, espace client, connexion à un logiciel de facturation, recherche avancée. Chaque fonctionnalité ajoute du développement et, surtout, des cas limites à tester.",
  },
  {
    titre: "La migration d'un site existant",
    texte:
      "Reprendre un site en place, c'est préserver les adresses, les redirections, les images et le trafic. Une refonte mal migrée peut effacer des années de référencement en une nuit.",
  },
  {
    titre: "Le référencement et la performance",
    texte:
      "Structure des titres, vitesse, images optimisées, plan du site, données structurées. Ce travail ne se voit pas à l'écran, mais il décide de ce que Google comprend et de ce que le visiteur attend.",
  },
];

const RECURRENT = [
  {
    poste: "Nom de domaine",
    prix: "5 à 50 € / an",
    note: "À votre nom, jamais à celui du prestataire.",
  },
  {
    poste: "Hébergement",
    prix: "5 à 30 € / mois",
    note: "En dessous de 5 € par mois, la vitesse et les sauvegardes se paient ailleurs.",
  },
  {
    poste: "Certificat HTTPS",
    prix: "0 à 100 € / an",
    note: "Souvent inclus dans l'hébergement, à vérifier et à renouveler.",
  },
  {
    poste: "Maintenance",
    prix: "30 à 70 € / mois",
    note: "Mises à jour, sauvegardes, surveillance. Indispensable sur WordPress.",
  },
  {
    poste: "Sauvegardes externes",
    prix: "0 à 15 € / mois",
    note: "Une sauvegarde sur le même serveur ne protège de rien.",
  },
  {
    poste: "Licences et extensions",
    prix: "0 à 300 € / an",
    note: "Thème premium, extension de réservation, outil d'emailing.",
  },
];

const MARCHES = [
  {
    prestation: "Site vitrine, prix affichés",
    moyen: "1 200 €",
    repere: "la moitié des offres se situent entre 690 et 1 800 €",
  },
  {
    prestation: "Site vitrine, budgets réellement engagés par une TPE",
    moyen: "4 000 €",
    repere: "un projet sur deux entre 2 500 et 10 600 €",
  },
  {
    prestation: "Boutique en ligne",
    moyen: "2 700 €",
    repere: "de 1 970 à 3 500 € en forfait, bien plus en agence",
  },
  {
    prestation: "Landing page",
    moyen: "1 900 €",
    repere: "de 800 à 3 000 € pour 3,5 à 5,5 jours de travail",
  },
  {
    prestation: "Refonte de site",
    moyen: "1 200 €",
    repere: "en forfait affiché, 3 500 à 5 000 € pour un rafraîchissement sérieux",
  },
  {
    prestation: "Maintenance mensuelle",
    moyen: "49 € / mois",
    repere: "de 30 à 69 € pour un site vitrine",
  },
];

const NOS_PRIX = [
  {
    offre: "Site statique sur mesure",
    range: "2 000 €",
    contenu: "HTML/CSS, cinq à sept pages, design sur mesure, rapide, sans base de données",
  },
  {
    offre: "Site vitrine WordPress",
    range: "2 750 €",
    contenu: "Cinq à dix pages, thème adapté, formation à la publication",
  },
  {
    offre: "Boutique Shopify",
    range: "4 000 €",
    contenu: "Thème adapté, structure catalogue, paiement, livraison, formation",
  },
  {
    offre: "Landing page",
    range: "1 250 €",
    contenu: "Une page, un objectif, maquette et intégration",
  },
  {
    offre: "Refonte ou évolution",
    range: "500 € / jour",
    contenu: "Travail à la journée, périmètre écrit avant de commencer",
  },
  {
    offre: "Maintenance et interventions",
    range: "62,50 € / heure",
    contenu: "Mises à jour, corrections, évolutions ponctuelles",
  },
];

const TEMPS = [
  { etape: "Cadrage et arborescence", vitrine: "2 à 4 h", boutique: "6 à 10 h" },
  { etape: "Design des modèles de pages", vitrine: "12 à 20 h", boutique: "20 à 30 h" },
  { etape: "Intégration et développement", vitrine: "10 à 18 h", boutique: "25 à 40 h" },
  { etape: "Contenus et recette", vitrine: "4 à 8 h", boutique: "8 à 14 h" },
  { etape: "Mise en ligne et formation", vitrine: "2 à 4 h", boutique: "3 à 6 h" },
];

const DEVIS = [
  "Le périmètre : nombre de modèles de pages, fonctionnalités, langues.",
  "Ce qui est inclus et ce qui ne l'est pas : textes, photos, traduction, référencement éditorial.",
  "Le nombre d'allers-retours prévu, et ce que coûte un aller-retour supplémentaire.",
  "Le délai, avec la date des contenus que vous devez fournir : c'est elle qui décide du calendrier.",
  "La propriété : code, nom de domaine, hébergement et accès à votre nom.",
  "Les coûts récurrents, annoncés séparément du prix de création.",
  "La garantie après mise en ligne et le prix des interventions hors forfait.",
];

export function GuidePrixSite() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1 className={styles.titre}>
              Combien coûte
              <br />
              un <span className={styles.accent}>site</span> ?
            </h1>
            <p className="intro">
              Un site internet se vend entre 500 € et plus de 10 000 €. Ce n&apos;est pas le
              même produit, ni le même travail, ni la même durée de vie. Voici les paliers
              observés sur le marché français en novembre 2026, les coûts récurrents que
              personne n&apos;annonce, et les prix pratiqués ici.
            </p>
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
                {SOMMAIRE.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="prose">
                <CoverFigure
                  slug="site-internet"
                  alt="Ordinateur portable ouvert sur un site web, sur un bureau clair."
                  caption="Un site se juge sur mobile, sur ce qu'il permet de faire, et sur ce qu'il coûte chaque mois une fois en ligne."
                />
                <h2 id="paliers">Les quatre paliers</h2>
                <p>
                  Le prix d&apos;un site ne monte pas avec le nombre de pages, il monte avec
                  ce qu&apos;on demande au site. Un site de vingt pages remplies à partir d&apos;un
                  thème coûte moins cher qu&apos;un site de cinq pages conçu de zéro.
                </p>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.caption}>
                      Paliers observés sur le marché français, hors taxes.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Palier</th>
                        <th scope="col">Ce qu&apos;on achète</th>
                        <th scope="col">Ce qu&apos;on ne trouve presque jamais</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PALIERS.map((palier) => (
                        <tr key={palier.fourchette}>
                          <th scope="row" className={styles.price}>
                            {palier.fourchette}
                          </th>
                          <td data-label="Ce qu'on achète">{palier.produit}</td>
                          <td data-label="Souvent absent">{palier.manque}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h2 id="prix">Ce qui fait monter le prix</h2>
                <p>
                  Six postes expliquent l&apos;écart entre un site à 800 € et un site à
                  6 000 €. Aucun n&apos;est décoratif : chacun correspond à des heures réelles.
                </p>
                {FACTEURS.map((facteur) => (
                  <p key={facteur.titre}>
                    <strong>{facteur.titre}.</strong> {facteur.texte}
                  </p>
                ))}

                <h2 id="recurrent">Les coûts récurrents, la ligne oubliée</h2>
                <p>
                  Le prix de création ne dit rien du coût de possession. Un site vitrine coûte
                  aussi quelque chose chaque mois, même quand personne n&apos;y touche : le nom
                  de domaine se renouvelle, l&apos;hébergement tourne, les mises à jour
                  s&apos;enchaînent. Voici ce qu&apos;il faut prévoir, hors travail de création.
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.caption}>
                      Coûts récurrents d&apos;un site vitrine, hors taxes, 2026.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Poste</th>
                        <th scope="col" className={styles.price}>
                          Ordre de prix
                        </th>
                        <th scope="col">À vérifier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RECURRENT.map((ligne) => (
                        <tr key={ligne.poste}>
                          <th scope="row">{ligne.poste}</th>
                          <td data-label="Ordre de prix" className={styles.price}>{ligne.prix}</td>
                          <td data-label="À vérifier">{ligne.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Un site vitrine correct se maintient donc autour de 40 à 100 € par mois, tout
                  compris. C&apos;est le chiffre à comparer aux offres à 16 € par mois des
                  constructeurs en ligne : elles incluent l&apos;outil, pas le travail.
                </p>

                <h2 id="marche">Les prix moyens du marché</h2>
                <p>
                  Repères moyens constatés en novembre 2026, hors taxes, tous prestataires
                  confondus. Les prix affichés et les budgets réellement signés ne racontent pas
                  la même histoire : c&apos;est la première chose à comprendre avant de comparer
                  des devis.
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.caption}>
                      Prix moyens observés, France, novembre 2026, hors taxes.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Prestation</th>
                        <th scope="col" className={styles.price}>
                          Prix moyen
                        </th>
                        <th scope="col">Repère</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MARCHES.map((ligne) => (
                        <tr key={ligne.prestation}>
                          <th scope="row">{ligne.prestation}</th>
                          <td data-label="Prix moyen" className={styles.price}>{ligne.moyen}</td>
                          <td data-label="Repère">{ligne.repere}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  L&apos;écart entre 1 200 € affichés et 4 000 € réellement engagés n&apos;est
                  pas une arnaque : les offres à 1 200 € couvrent une installation, pas un
                  projet. Entre les deux, il y a le design, les contenus, la recette et la
                  formation, qui sont exactement ce qu&apos;un site doit contenir pour servir à
                  quelque chose.
                </p>

                <h2 id="nos-prix">Nos prix</h2>
                <p>
                  Tarifs du studio, hors taxes, en novembre 2026. Ce sont des prix de départ :
                  le devis les précise selon le nombre de modèles de pages et les
                  fonctionnalités demandées.
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.caption}>
                      Prix de départ, hors taxes, avant devis.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Offre</th>
                        <th scope="col" className={styles.price}>
                          Prix de départ
                        </th>
                        <th scope="col">Ce qui est inclus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {NOS_PRIX.map((ligne) => (
                        <tr key={ligne.offre}>
                          <th scope="row">{ligne.offre}</th>
                          <td data-label="Prix de départ" className={styles.price}>{ligne.range}</td>
                          <td data-label="Ce qui est inclus">{ligne.contenu}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={styles.note}>
                  Les coûts récurrents (domaine, hébergement, licences) ne sont pas inclus : ils
                  sont pris à votre nom, et vous les gardez si nous arrêtons de travailler
                  ensemble. Les textes et les photos sont fournis par vous, sauf mention
                  contraire au devis.
                </p>

                <h2 id="temps">Le temps de travail</h2>
                <p>
                  Un site ne se facture pas au nombre de pages mais au temps de conception. À
                  500 € la journée, soit 62,50 € de l&apos;heure, voici les ordres de grandeur
                  d&apos;un site vitrine et d&apos;une boutique.
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.caption}>
                      Temps de travail estimé par étape, hors échanges clients.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Étape</th>
                        <th scope="col" className={styles.price}>
                          Site vitrine
                        </th>
                        <th scope="col" className={styles.price}>
                          Boutique
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {TEMPS.map((ligne) => (
                        <tr key={ligne.etape}>
                          <th scope="row">{ligne.etape}</th>
                          <td data-label="Site vitrine" className={styles.price}>{ligne.vitrine}</td>
                          <td data-label="Boutique" className={styles.price}>{ligne.boutique}</td>
                        </tr>
                      ))}
                      <tr>
                        <th scope="row">Total</th>
                        <td data-label="Site vitrine" className={styles.price}>30 à 54 h</td>
                        <td data-label="Boutique" className={styles.price}>62 à 100 h</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  Trente à cinquante-quatre heures représentent 1 875 à 3 375 € au tarif
                  journalier du studio. Un site vitrine à 2 750 € se situe donc dans le temps
                  réel du travail, pas au-dessus. Une boutique à 4 000 € correspond à environ
                  soixante-cinq heures, soit le bas de la fourchette : c&apos;est le prix d&apos;un
                  projet cadré, pas d&apos;un catalogue de trois cents références.
                </p>

                <h2 id="devis">Ce qu&apos;un devis doit contenir</h2>
                <p>
                  Un devis de site internet se juge sur ce qu&apos;il précise, pas sur son
                  montant. Sept points doivent y figurer, sinon la comparaison entre deux offres
                  ne veut rien dire.
                </p>
                <ul>
                  {DEVIS.map((ligne) => (
                    <li key={ligne}>{ligne}</li>
                  ))}
                </ul>
                <p>
                  Pour préparer la discussion, le{" "}
                  <Link href={routes.modeleCahierDesCharges}>modèle de cahier des charges</Link>{" "}
                  liste les douze blocs à remplir avant de demander un devis. La page{" "}
                  <Link href={serviceHref("site-ecommerce")}>sites et e-commerce</Link> détaille
                  ce qui est livré, et le{" "}
                  <Link href={routes.guidePrixLogo}>guide des prix du logo</Link> applique la
                  même logique à l&apos;identité visuelle. Le{" "}
                  <Link href={routes.calculateurBudgetIdentite}>calculateur de budget</Link>{" "}
                  chiffre de son côté une identité complète, souvent le préalable à un site.
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
              <p>Un périmètre, puis un devis.</p>
              <p className={styles.ctaText}>
                Décrivez votre projet en trois lignes : je réponds avec un ordre de prix et les
                questions qui manquent.
              </p>
            </div>
            <div className={styles.ctaLinks}>
              <Link className="btn-fill btn-fill--light" href={routes.contact}>
                Décrire mon projet <span aria-hidden="true">↗</span>
              </Link>
              <Link className="btn-line btn-line--light" href={serviceHref("site-ecommerce")}>
                Voir l&apos;offre sites et e-commerce
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
