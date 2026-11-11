import Link from "next/link";
import Faq from "@/components/Faq";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./GuidePrixLogo.module.css";
import { CoverFigure } from "./CoverFigure";

/**
 * Page /ressources/modele-cahier-des-charges-site (P8).
 *
 * Page outil : le livrable est le fichier (DOCX modifiable + PDF), la page
 * explique à quoi il sert, ce qu'il contient et comment s'en servir face à un
 * prestataire. Aucun e-mail demandé, ce qui est aussi un argument.
 */
export const pageMeta = {
  title: "Modèle de cahier des charges site internet",
  description:
    "Un modèle de cahier des charges pour site internet : douze blocs, les questions qui évitent les devis flous, en DOCX et PDF. Gratuit, sans inscription.",
};

export const aeo = {
  question: "Comment rédiger un cahier des charges pour un site internet ?",
  answer:
    "Un cahier des charges de site internet tient en douze blocs : le projet et son objectif principal, les publics, l'arborescence des pages, les fonctionnalités, les contenus et qui les fournit, la direction visuelle, le cadre technique, le référencement, le planning, le budget, les livrables et la vie du site après la mise en ligne. Deux à quatre heures suffisent pour une version utile. Il se rédige avant de demander un devis : il décrit le besoin, le devis décrit la réponse et son prix. Il doit aussi nommer le décisionnaire, les dates de contenus et la propriété du nom de domaine.",
};

export const faqItems = [
  {
    question: "Un cahier des charges, c'est obligatoire ?",
    answer:
      "Non, rien ne l'impose. C'est simplement le document qui vous permet de comparer deux devis sur le même périmètre, et de vous rappeler six mois plus tard pourquoi une fonctionnalité a été écartée. Sans lui, la comparaison se fait au prix affiché, ce qui est la pire façon de choisir.",
  },
  {
    question: "Combien de pages doit faire un cahier des charges ?",
    answer:
      "Cinq à dix pages suffisent pour un site vitrine ou une boutique. Un document de quarante pages est souvent un document que personne n'a lu, y compris celui qui l'a payé. Ce qui compte est la précision du besoin, pas l'épaisseur.",
  },
  {
    question: "Qui doit l'écrire, moi ou le prestataire ?",
    answer:
      "Vous, pour la partie besoin : ce que vous vendez, à qui, et ce que le site doit produire. Le prestataire complète ensuite la partie solution : technologie, hébergement, découpage des étapes. Si un prestataire rédige seul votre cahier des charges, il cadre son propre travail.",
  },
  {
    question: "Faut-il parler technique pour être pris au sérieux ?",
    answer:
      "Non, et c'est même l'inverse. Un prestataire sérieux préfère un besoin clair à un vocabulaire technique approximatif. En revanche, trois points doivent être écrits noir sur blanc : qui possède le nom de domaine, qui fournit les contenus et à quelle date, et ce qui se passe après la mise en ligne.",
  },
  {
    question: "Le modèle convient-il à une refonte ?",
    answer:
      "Oui, deux blocs changent de ton : l'arborescence doit lister les anciennes adresses pour préparer les redirections, et le bloc technique doit préciser ce qui est repris ou abandonné de l'existant. Les onze autres blocs restent identiques.",
  },
  {
    question: "Que faire si je ne sais pas répondre à une question ?",
    answer:
      "Laissez la case vide et notez la question à poser au prestataire. Un blanc assumé vaut mieux qu'une réponse inventée : c'est exactement ce que le premier rendez-vous doit servir à trancher.",
  },
];

const SOMMAIRE = [
  { href: "#telecharger", label: "Télécharger le modèle" },
  { href: "#utilite", label: "À quoi ça sert" },
  { href: "#blocs", label: "Les douze blocs" },
  { href: "#formuler", label: "Écrire utilement" },
  { href: "#prestataire", label: "S'en servir face à un devis" },
  { href: "#faq", label: "Questions" },
];

const BLOCS = [
  {
    num: "01",
    titre: "Le projet en une page",
    question: "Que faites-vous, pourquoi un site, quel objectif unique ?",
    vide: "Le prestataire propose ce qu'il sait faire, pas ce dont vous avez besoin.",
  },
  {
    num: "02",
    titre: "Les publics",
    question: "Qui doit trouver le site, et qu'est-ce qui le fait hésiter ?",
    vide: "Le site parle à tout le monde, donc à personne. Les textes restent génériques.",
  },
  {
    num: "03",
    titre: "L'arborescence",
    question: "Quelles pages, avec quel objectif et quelle priorité ?",
    vide: "Le nombre de pages devient un sujet de négociation en cours de projet.",
  },
  {
    num: "04",
    titre: "Les fonctionnalités",
    question: "De quoi le site doit-il être capable au lancement ?",
    vide: "Une option oubliée se paie au tarif de l'urgence, ou attend l'année suivante.",
  },
  {
    num: "05",
    titre: "Les contenus",
    question: "Qui écrit les textes, qui fournit les photos, pour quand ?",
    vide: "C'est la première cause de retard : tout le monde attend les contenus.",
  },
  {
    num: "06",
    titre: "La direction visuelle",
    question: "Trois références aimées, trois détestées, et pourquoi.",
    vide: "Le projet part sur une proposition au hasard, puis se corrige par allers-retours.",
  },
  {
    num: "07",
    titre: "Le cadre technique",
    question: "Domaine, hébergement, qui modifiera les textes ensuite ?",
    vide: "Vous pouvez vous retrouver avec un site dont vous ne détenez pas les accès.",
  },
  {
    num: "08",
    titre: "Le référencement",
    question: "Cinq à dix recherches visées, et les anciennes adresses si refonte.",
    vide: "La refonte perd le trafic acquis, faute de redirections préparées.",
  },
  {
    num: "09",
    titre: "Le planning",
    question: "Date de mise en ligne, contraintes de calendrier, qui valide.",
    vide: "Deux interlocuteurs valident chacun leur tour et le projet n'avance plus.",
  },
  {
    num: "10",
    titre: "Le budget",
    question: "Enveloppe de création et budget annuel de fonctionnement.",
    vide: "Les offres reçues ne sont pas comparables, et les coûts récurrents arrivent après.",
  },
  {
    num: "11",
    titre: "Les livrables",
    question: "Ce qui est remis à la fin, et comment se passe la réception.",
    vide: "Le site est en ligne, mais la formation, la documentation et les accès manquent.",
  },
  {
    num: "12",
    titre: "Après la mise en ligne",
    question: "Qui met à jour, qui sauvegarde, quelles évolutions sont prévues.",
    vide: "Le site se dégrade sans que personne ne s'en aperçoive, jusqu'au jour où il casse.",
  },
];

const BON_MAUVAIS = [
  {
    vague: "« Un site moderne et épuré. »",
    utile:
      "« Un site qui s'ouvre en moins de deux secondes sur mobile, avec une page par service et un formulaire de devis à trois champs. »",
  },
  {
    vague: "« Je veux être premier sur Google. »",
    utile:
      "« Apparaître sur les recherches “graphiste Cergy” et “création de logo Paris”, et suivre les positions dans Search Console. »",
  },
  {
    vague: "« Il faut que ce soit joli. »",
    utile:
      "« Reprendre les couleurs de la charte 2024, photos de chantier réelles, pas d'image de banque. »",
  },
  {
    vague: "« On verra plus tard pour les textes. »",
    utile:
      "« Les textes des six pages sont fournis le 15 janvier, relus et validés. Les pages légales sont rédigées par le prestataire. »",
  },
];

const DEVIS = [
  "Le périmètre écrit dans le cahier des charges se retrouve dans le devis, ligne par ligne. S'il manque une page ou une fonctionnalité, l'écart est visible avant de signer.",
  "Les contenus sont attribués : ce que vous fournissez, ce que le prestataire fournit, avec des dates.",
  "La propriété est nommée : nom de domaine, hébergement, code et accès à votre nom.",
  "Les coûts récurrents sont annoncés séparément du prix de création, avec leur périodicité.",
  "Le nombre d'allers-retours est chiffré, et le prix d'un aller-retour supplémentaire est indiqué.",
  "La recette est décrite : ce qui est testé, par qui, et ce qui se passe si une anomalie apparaît après la mise en ligne.",
];

export function ModeleCahierDesCharges() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1 className={styles.titre}>
              Le cahier des charges
              <br />
              qui évite les <span className={styles.accent}>mauvaises surprises</span>
            </h1>
            <p className="intro">
              Douze blocs à remplir, deux à quatre heures de votre temps, et un devis qui
              parle enfin du même projet que le vôtre. Le modèle est gratuit, sans
              inscription et sans e-mail à laisser.
            </p>
            <div className={styles.dlRow}>
              <a className="btn-fill" href="/assets/ressources/cahier-des-charges-site-2026.docx" download>
                Télécharger le DOCX <span aria-hidden="true">↓</span>
              </a>
              <a className="btn-line" href="/assets/ressources/cahier-des-charges-site-2026.pdf" download>
                Télécharger le PDF <span aria-hidden="true">↓</span>
              </a>
              <span className={styles.dlMeta}>10 pages · 41 Ko · novembre 2026</span>
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
                {SOMMAIRE.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="prose">
                <CoverFigure
                  slug="cahier-des-charges"
                  alt="Ordinateur portable affichant la couverture d'un cahier des charges de site internet, dans un bureau."
                  caption="Le modèle se remplit à l'écran ou à l'impression, puis s'envoie tel quel avec la demande de devis."
                />
                <h2 id="utilite">À quoi ça sert vraiment</h2>
                <p>
                  Un cahier des charges n&apos;est pas un document administratif à joindre à
                  une demande de devis pour faire sérieux. C&apos;est l&apos;outil qui vous
                  permet de comparer deux propositions sur le même périmètre, et de trancher
                  les désaccords en regardant ce qui était écrit.
                </p>
                <p>
                  Il sert d&apos;abord à comparer. Deux devis de 2 500 € et 4 200 € ne veulent
                  rien dire si l&apos;un comprend la conception des pages, la formation et la
                  garantie, et l&apos;autre l&apos;intégration d&apos;un thème acheté. Avec un
                  périmètre écrit, la différence de prix devient une différence de travail.
                </p>
                <p>
                  Il sert ensuite à décider. Une case vide sur les contenus ou sur le
                  décisionnaire annonce un retard, pas un oubli sans conséquence. Remplir le
                  document force à répondre à des questions qu&apos;on repousse en réunion.
                </p>
                <p>
                  Il sert enfin à se souvenir. Dix-huit mois plus tard, quand vous voudrez
                  ajouter une boutique ou changer de prestataire, le document dit ce qui était
                  prévu, ce qui a été livré et à qui appartiennent les accès.
                </p>

                <h2 id="blocs">Les douze blocs</h2>
                <p>
                  Douze blocs, dans cet ordre. Chacun tient en quelques phrases. La dernière
                  colonne indique ce qui se passe quand le bloc reste vide : c&apos;est
                  généralement là que le projet dérape.
                </p>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.caption}>
                      Structure du modèle, version de novembre 2026, hors taxes.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Bloc</th>
                        <th scope="col">La question à laquelle il répond</th>
                        <th scope="col">Si c&apos;est vide</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BLOCS.map((bloc) => (
                        <tr key={bloc.num}>
                          <th scope="row">
                            {bloc.num} · {bloc.titre}
                          </th>
                          <td data-label="Question">{bloc.question}</td>
                          <td data-label="Si c'est vide">{bloc.vide}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h2 id="formuler">Écrire utilement</h2>
                <p>
                  La difficulté n&apos;est pas de remplir les cases, c&apos;est de les remplir
                  avec des phrases qui engagent quelque chose. Quatre exemples suffisent à voir
                  la différence entre une intention et un besoin.
                </p>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.caption}>
                      Même besoin, deux façons de l&apos;écrire.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Formulation vague</th>
                        <th scope="col">Formulation utilisable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BON_MAUVAIS.map((paire) => (
                        <tr key={paire.vague}>
                          <th scope="row">{paire.vague}</th>
                          <td data-label="Formulation utilisable">{paire.utile}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p>
                  Une règle simple : si une phrase pourrait décrire n&apos;importe quel site,
                  elle ne décrit pas le vôtre. « Moderne », « épuré », « intuitif » ne sont pas
                  des besoins, ce sont des adjectifs. « Un formulaire de devis en trois champs,
                  avec un accusé de réception automatique » est un besoin.
                </p>

                <h2 id="prestataire">S&apos;en servir face à un devis</h2>
                <p>
                  Envoyez le document rempli avec votre demande, ou remplissez-le pendant le
                  premier rendez-vous. Ce que vous devez retrouver dans la réponse :
                </p>
                <ul>
                  {DEVIS.map((ligne) => (
                    <li key={ligne}>{ligne}</li>
                  ))}
                </ul>
                <p>
                  Si un devis ne reprend pas ces points, ce n&apos;est pas un mauvais
                  prestataire, c&apos;est un devis incomplet : demandez la version détaillée
                  avant de comparer les montants. Un prestataire sérieux préfère cette
                  conversation avant la signature qu&apos;après.
                </p>
                <p>
                  Pour situer les montants, le{" "}
                  <Link href={routes.guidePrixSite}>guide des prix d&apos;un site</Link> détaille
                  les quatre paliers et les coûts récurrents, et la page{" "}
                  <Link href={serviceHref("site-ecommerce")}>sites et e-commerce</Link> montre
                  ce qui est livré ici. Si votre identité visuelle n&apos;est pas encore posée,
                  le <Link href={routes.guidePrixLogo}>guide des prix du logo</Link> et le{" "}
                  <Link href={routes.calculateurBudgetIdentite}>calculateur de budget</Link>{" "}
                  traitent la partie amont.
                </p>

                <h2 id="telecharger">Le modèle</h2>
                <p>
                  Le fichier contient les douze sections avec une case par question, deux
                  tableaux à remplir (arborescence et validation) et la liste des six erreurs
                  qui coûtent cher. Il est fourni en DOCX pour être rempli à l&apos;écran ou
                  imprimé, et en PDF pour être lu sur téléphone.
                </p>
                <div className={styles.dlRow}>
                  <a className="btn-fill" href="/assets/ressources/cahier-des-charges-site-2026.docx" download>
                    Modèle DOCX <span aria-hidden="true">↓</span>
                  </a>
                  <a className="btn-line" href="/assets/ressources/cahier-des-charges-site-2026.pdf" download>
                    Modèle PDF <span aria-hidden="true">↓</span>
                  </a>
                  <span className={styles.dlMeta}>Sans inscription · usage libre</span>
                </div>

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
              <p>Le document est rempli ?</p>
              <p className={styles.ctaText}>
                Envoyez-le tel quel : je réponds avec un ordre de prix, les points à trancher
                et ce qui manque encore pour cadrer le projet.
              </p>
            </div>
            <div className={styles.ctaLinks}>
              <Link className="btn-fill btn-fill--light" href={routes.contact}>
                Envoyer mon cahier des charges <span aria-hidden="true">↗</span>
              </Link>
              <Link className="btn-line btn-line--light" href={routes.guidePrixSite}>
                Voir les prix d&apos;un site
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
