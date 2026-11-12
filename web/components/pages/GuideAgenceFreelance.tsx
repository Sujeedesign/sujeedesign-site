import Link from "next/link";
import Faq from "@/components/Faq";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./GuidePrixLogo.module.css";
import {
  IlluCoordination,
  IlluDecision,
  IlluTroisOptions,
} from "./GuideIllu";

/**
 * Page /guides/agence-ou-freelance (D1).
 *
 * Guide de décision : à qui confier un projet de marque. Même grammaire que les
 * guides de prix (bloc « En bref », sommaire, tableaux, FAQ). Aucun chiffre de
 * marché n'est présenté comme une vérité : ce sont des ordres de grandeur
 * observés, et le prix du studio reste celui des guides.
 */
export const pageMeta = {
  title: "Agence ou graphiste freelance : qui choisir ?",
  description:
    "Agence, studio ou freelance : ce que change chaque option sur le prix, le délai, la continuité et la propriété des fichiers. Une grille pour décider.",
};

export const aeo = {
  question: "Faut-il travailler avec une agence ou avec un freelance ?",
  answer:
    "Ni l'un ni l'autre n'est meilleur dans l'absolu. Une agence apporte plusieurs métiers sous un même toit et absorbe les gros volumes, avec un surcoût de structure. Un freelance ou un studio indépendant coûte moins cher à périmètre égal, décide plus vite et garde la mémoire du projet, mais ne peut pas tout faire en même temps. La bonne question n'est pas « qui est le meilleur » mais « mon projet demande-t-il plusieurs métiers en parallèle, ou une seule tête qui pense l'ensemble ».",
};

export const faqItems = [
  {
    question: "Un freelance est-il forcément moins cher qu'une agence ?",
    answer:
      "À périmètre égal, presque toujours, parce qu'il n'y a pas de commerciaux, de chef de projet et de loyer à financer. Mais la comparaison n'a de sens qu'à livrables identiques : une agence inclut souvent la coordination, la relecture et la garantie de délai, qu'un indépendant facture autrement ou ne fournit pas.",
  },
  {
    question: "Comment savoir si un freelance sous-traite ?",
    answer:
      "Demandez qui exécute quoi, et rencontrez la personne qui fera le travail. Un indépendant qui s'entoure de photographes ou de développeurs, c'est normal et souvent utile, à condition que ce soit dit avant la signature et que les responsabilités soient écrites.",
  },
  {
    question: "Qui possède les fichiers à la fin du projet ?",
    answer:
      "Vous, si le contrat le dit. Les fichiers sources, les polices achetées et les accès au nom de domaine doivent être livrés à votre nom. Un prestataire qui garde les fichiers vectoriels ou le nom de domaine garde en réalité le contrôle de votre marque.",
  },
  {
    question: "Peut-on changer de prestataire en cours de route ?",
    answer:
      "C'est possible mais coûteux si les sources ne sont pas livrées. La bonne pratique est de demander les fichiers à chaque étape validée, pas seulement à la fin. Un prestataire sérieux n'y voit aucun problème.",
  },
  {
    question: "Une agence est-elle plus sûre pour un gros projet ?",
    answer:
      "Elle absorbe mieux un pic de volume et couvre plusieurs métiers en parallèle : campagne, site, photo, impression. En contrepartie, vous parlez souvent à un chef de projet plutôt qu'à la personne qui dessine, et le surcoût de structure se paie.",
  },
  {
    question: "Combien de temps pour recevoir une proposition ?",
    answer:
      "Comptez trois à dix jours pour une proposition sérieuse. Une réponse en deux heures est souvent le signe d'un devis recopié, pas d'un projet compris. La proposition doit reprendre vos contraintes, sinon elle ne vaut rien.",
  },
  {
    question: "Faut-il demander un test ou un concours de logo ?",
    answer:
      "Non, dans la grande majorité des cas. Un travail gratuit et rapide ne dit rien de la capacité à livrer un système de marque. Mieux vaut demander comment le prestataire a résolu un problème comparable, et regarder les fichiers du projet final, pas la vignette du portfolio.",
  },
];

const SOMMAIRE = [
  { href: "#options", label: "Les trois options" },
  { href: "#comparer", label: "Comparer vraiment" },
  { href: "#quand-agence", label: "Quand l'agence gagne" },
  { href: "#quand-freelance", label: "Quand le freelance gagne" },
  { href: "#signaux", label: "Les signaux d'alerte" },
  { href: "#grille", label: "La grille de décision" },
  { href: "#questions", label: "Les questions à poser" },
  { href: "#faq", label: "Questions fréquentes" },
];

const OPTIONS = [
  {
    nom: "L'agence",
    equipe:
      "Direction de création, chef de projet, DA, graphistes, parfois développeur et photographe en interne.",
    cout:
      "20 à 40 % plus cher à périmètre égal, parce que la structure se paie : locaux, coordination, commerciaux.",
    force:
      "Plusieurs métiers en parallèle, volumes importants, garantie de délai sur une campagne complète.",
    limite:
      "Vous parlez souvent à un chef de projet, pas à la personne qui dessine. Le surcoût doit se justifier.",
  },
  {
    nom: "Le studio indépendant",
    equipe:
      "Une ou deux personnes qui pensent l'ensemble et s'entourent de spécialistes au besoin.",
    cout:
      "Entre le freelance et l'agence : pas de structure lourde, mais un vrai périmètre de direction.",
    force:
      "Cohérence entre l'identité, le site et les supports, avec un seul interlocuteur du début à la fin.",
    limite:
      "Un seul projet à la fois ou presque : le calendrier peut dépendre d'une autre mission en cours.",
  },
  {
    nom: "Le freelance spécialisé",
    equipe: "Une personne, un métier : logo, site, photo, illustration, motion.",
    cout:
      "Le plus bas à périmètre égal, avec des tarifs journaliers qui varient du simple au triple selon l'expérience.",
    force:
      "Réactivité, relation directe, coût maîtrisé quand le besoin est précis et le brief clair.",
    limite:
      "Pas de coordination entre métiers : à vous de faire dialoguer le logo, le site et la campagne.",
  },
];

const COMPARAISON = [
  {
    critere: "Prix à périmètre égal",
    agence: "Le plus élevé",
    studio: "Médian",
    freelance: "Le plus bas",
  },
  {
    critere: "Nombre d'interlocuteurs",
    agence: "Deux à quatre",
    studio: "Un",
    freelance: "Un",
  },
  {
    critere: "Délai de mise en route",
    agence: "Une à trois semaines",
    studio: "Quelques jours",
    freelance: "Quelques jours",
  },
  {
    critere: "Métiers couverts en parallèle",
    agence: "Trois à six",
    studio: "Deux à trois",
    freelance: "Un",
  },
  {
    critere: "Continuité sur plusieurs années",
    agence: "Dépend de l'équipe affectée",
    studio: "Forte",
    freelance: "Forte, s'il est encore là",
  },
  {
    critere: "Quand le projet double de volume",
    agence: "Absorbe",
    studio: "S'entoure",
    freelance: "Renégocie le délai",
  },
];

const SIGNAUX = [
  {
    titre: "Un portfolio identique pour tous les clients",
    texte:
      "Si le site montre dix projets qui se ressemblent, ce n'est pas un système de marque, c'est un gabarit. Regardez la diversité des secteurs et des contraintes, pas la beauté des vignettes.",
  },
  {
    titre: "Un devis sans périmètre",
    texte:
      "Un prix sans nombre de pistes, sans nombre de déclinaisons, sans allers-retours prévus et sans délai n'est pas un devis, c'est une intention. C'est là que naissent les dépassements.",
  },
  {
    titre: "Une réponse en deux heures",
    texte:
      "Une proposition sérieuse demande de lire le brief, parfois de poser deux questions. Une réponse immédiate est souvent un modèle recopié, avec votre nom dans l'en-tête.",
  },
  {
    titre: "Des fichiers qui n'arrivent jamais",
    texte:
      "Fichiers sources, polices achetées, accès au nom de domaine, comptes d'hébergement : tout doit être à votre nom. Un prestataire qui les garde garde la main.",
  },
  {
    titre: "Un tarif horaire sans plafond",
    texte:
      "La facturation au temps est honnête quand le périmètre est flou. Sans plafond annoncé, elle devient une incertitude que vous portez seul.",
  },
];

const GRILLE = [
  {
    question: "Le projet demande-t-il plusieurs métiers en même temps ?",
    reponse:
      "Identité, site, photo, campagne, impression : si tout doit sortir en six semaines, l'agence ou un studio entouré devient la bonne option. Un freelance seul ne peut pas tout produire en parallèle.",
  },
  {
    question: "Avez-vous un brief écrit ?",
    reponse:
      "Avec un brief clair, un freelance livre vite et bien. Sans brief, une structure qui cadre le projet vous fera gagner du temps, et cet accompagnement se paie.",
  },
  {
    question: "Le budget dépasse-t-il 20 000 € ?",
    reponse:
      "Au-delà, le risque financier justifie la coordination d'une agence. En dessous, le surcoût de structure pèse plus lourd que le bénéfice.",
  },
  {
    question: "Voulez-vous garder la même personne dans trois ans ?",
    reponse:
      "Si la continuité compte, cherchez quelqu'un qui travaille seul ou en petit studio. Dans une agence, l'équipe affectée change avec les années et les départs.",
  },
  {
    question: "Qui décidera, chez vous ?",
    reponse:
      "Un décisionnaire unique accélère tout, avec un freelance comme avec une agence. Trois avis qui se contredisent coûtent plus cher que le prix du prestataire.",
  },
];

const QUESTIONS = [
  "Qui fera réellement le travail, et rencontrerai-je cette personne avant de signer ?",
  "Quel est le périmètre exact : nombre de pistes, de déclinaisons, d'allers-retours ?",
  "Que se passe-t-il si le projet prend du retard de mon côté ?",
  "À qui appartiendront les fichiers sources et les comptes techniques ?",
  "Comment les prestataires extérieurs sont-ils choisis et facturés ?",
  "Quel est le prix d'une intervention après la livraison, hors forfait ?",
  "Pouvez-vous montrer un projet comparable, avec ses contraintes réelles ?",
];

export function GuideAgenceFreelance() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1 className={styles.titre}>
              Agence
              <br />
              ou <span className={styles.accent}>freelance</span> ?
            </h1>
            <p className="intro">
              Les deux travaillent bien. La différence se joue sur trois choses : combien de
              métiers il faut faire tourner en même temps, qui décide, et qui garde les fichiers
              à la fin. Voici comment trancher sans se raconter d&apos;histoire.
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
                <h2 id="options">Les trois options, sans caricature</h2>
                <p>
                  On oppose souvent « l&apos;agence chère et lente » au « freelance pas cher et
                  rapide ». C&apos;est faux dans les deux sens. Ce qui change vraiment, c&apos;est
                  le nombre de personnes qui doivent se coordonner pour livrer votre projet, et
                  qui paie cette coordination.
                </p>
                <IlluTroisOptions />
                {OPTIONS.map((option) => (
                  <div key={option.nom}>
                    <h3>{option.nom}</h3>
                    <p>
                      <strong>Qui travaille.</strong> {option.equipe}
                    </p>
                    <p>
                      <strong>Ce que ça coûte.</strong> {option.cout}
                    </p>
                    <p>
                      <strong>Ce que ça apporte.</strong> {option.force}
                    </p>
                    <p>
                      <strong>Ce que ça limite.</strong> {option.limite}
                    </p>
                  </div>
                ))}

                <h2 id="comparer">Comparer vraiment, pas au ressenti</h2>
                <p>
                  Deux propositions ne se comparent que si elles décrivent le même travail. Le
                  tableau ci-dessous donne les points de bascule observés sur des projets de
                  marque, du plus structuré au plus léger.
                </p>
                <IlluCoordination />

                <div className="tableWrap">
                  <table>
                    <caption>
                      Points de bascule entre agence, studio indépendant et freelance, 2026.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Critère</th>
                        <th scope="col">Agence</th>
                        <th scope="col">Studio</th>
                        <th scope="col">Freelance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARAISON.map((ligne) => (
                        <tr key={ligne.critere}>
                          <th scope="row">{ligne.critere}</th>
                          <td data-label="Agence">{ligne.agence}</td>
                          <td data-label="Studio">{ligne.studio}</td>
                          <td data-label="Freelance">{ligne.freelance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h2 id="quand-agence">Quand l&apos;agence est le bon choix</h2>
                <p>
                  L&apos;agence gagne quand le projet ressemble moins à un livrable qu&apos;à une
                  campagne : plusieurs supports, plusieurs langues, une date de lancement qui ne
                  bouge pas, et des interlocuteurs internes qui n&apos;ont pas le temps de
                  coordonner. Elle gagne aussi quand le volume est tel qu&apos;un seul
                  indépendant deviendrait le goulot d&apos;étranglement.
                </p>
                <p>
                  Le surcoût n&apos;est pas du gaspillage : il paie la coordination, la relecture
                  et la capacité à absorber un imprévu sans repousser la date. Si votre projet
                  n&apos;a besoin d&apos;aucune de ces trois choses, vous payez pour rien.
                </p>

                <h2 id="quand-freelance">Quand le freelance ou le studio gagne</h2>
                <p>
                  Dès que le projet tient dans un périmètre écrit : une identité, un site, une
                  campagne. Un indépendant décide plus vite, coûte moins cher à travail égal et
                  garde la mémoire du projet d&apos;une année sur l&apos;autre. C&apos;est
                  rarement un détail : la personne qui a dessiné votre logo sait pourquoi la
                  typographie penche à gauche, et cette raison se perd dans un turn-over.
                </p>
                <p>
                  La condition, c&apos;est le brief. Un freelance sans brief clair avance à
                  l&apos;aveugle et le fait payer en allers-retours. Un brief écrit, même court,
                  est ce qui rend l&apos;indépendant plus efficace qu&apos;une équipe.
                </p>

                <h2 id="signaux">Les cinq signaux d&apos;alerte</h2>
                <p>
                  Ils valent pour les deux camps. Un devis à 4 000 € peut être une bonne affaire
                  comme une mauvaise, selon ce qu&apos;il précise. Ces cinq points révèlent le
                  sérieux d&apos;une proposition plus sûrement que son montant.
                </p>
                {SIGNAUX.map((signal) => (
                  <p key={signal.titre}>
                    <strong>{signal.titre}.</strong> {signal.texte}
                  </p>
                ))}

                <h2 id="grille">La grille de décision</h2>
                <p>
                  Cinq questions suffisent. Si vous répondez « oui » à la première ou à la
                  troisième, regardez du côté de l&apos;agence. Si vous répondez « non » aux deux,
                  un studio indépendant fera le travail pour moins cher.
                </p>
                <IlluDecision />
                <ul>
                  {GRILLE.map((item) => (
                    <li key={item.question}>
                      <strong>{item.question}</strong> {item.reponse}
                    </li>
                  ))}
                </ul>

                <h2 id="questions">Les questions à poser avant de signer</h2>
                <p>
                  Elles désarment les mauvaises surprises et ne vexent jamais un professionnel
                  sérieux. Posez-les par écrit, gardez les réponses : c&apos;est déjà la moitié du
                  contrat.
                </p>
                <ul>
                  {QUESTIONS.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
                <p>
                  Pour cadrer la demande en amont, le{" "}
                  <Link href={routes.generateurBriefIdentite}>générateur de brief créatif</Link>{" "}
                  pose les dix questions qui manquent toujours, et le{" "}
                  <Link href={routes.modeleCahierDesCharges}>modèle de cahier des charges</Link>{" "}
                  s&apos;occupe du projet de site. Côté budget, le{" "}
                  <Link href={routes.guidePrixLogo}>guide des prix du logo</Link> et le{" "}
                  <Link href={routes.guidePrixSite}>guide des prix d&apos;un site</Link> donnent
                  les fourchettes réelles, et le{" "}
                  <Link href={routes.calculateurBudgetIdentite}>calculateur d&apos;identité</Link>{" "}
                  chiffre le tout en trente secondes. La page{" "}
                  <Link href={serviceHref("identite-de-marque")}>identité de marque</Link>{" "}
                  détaille, elle, ce qui est livré quand on travaille avec le studio.
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
              <p>Le bon format, pas le plus gros.</p>
              <p className={styles.ctaText}>
                Décrivez votre projet en trois lignes : je vous dis ce qui relève d&apos;un
                freelance, ce qui demande une équipe, et ce que ça change côté budget.
              </p>
            </div>
            <div className={styles.ctaLinks}>
              <Link className="btn-fill btn-fill--light" href={routes.contact}>
                Décrire mon projet <span aria-hidden="true">↗</span>
              </Link>
              <Link className="btn-line btn-line--light" href={serviceHref("identite-de-marque")}>
                Voir l&apos;offre identité
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
