/**
 * Page /ressources/calculateur-budget-identite.
 *
 * Les textes sont ceux des briefs P2 (`/opt/data/shared/briefs/`), recopiés sans
 * reformulation. Tout le contenu éditorial (intro, méthode, facteurs, tableaux, section
 * prix, section IA, FAQ) est rendu par le serveur : le HTML initial contient les textes,
 * les tableaux et la FAQ, ce qui rend la page indexable même sans JavaScript.
 * `BudgetIdentityCalculator` n'ajoute que le calcul, côté navigateur.
 *
 * Mise en page : réutilise la grille éditoriale du site (`.legal` + sommaire sticky +
 * `.prose`) utilisée par les mentions légales, pour ne pas inventer une troisième
 * grammaire visuelle.
 */
import Link from "next/link";
import { BudgetIdentityCalculator } from "@/components/BudgetIdentityCalculator";
import {
  ComparaisonParcours,
  IaVsDesigner,
  RepartitionTemps,
} from "@/components/pages/CalculateurFigures";
import { BASES, OPTIONS, formatRange } from "@/lib/budget-identity";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./CalculateurBudget.module.css";

export const pageMeta = {
  title: "Calculateur de budget identité visuelle",
  description:
    "Estimez en 30 secondes le budget d'un logo ou d'une identité visuelle, du logo simple au branding complet. Fourchettes réelles, sans engagement.",
};

/** FAQ de la page, partagée avec le JSON-LD `FAQPage` (une seule source de vérité). */
export const faqItems = [
  {
    question: "Pourquoi une fourchette et pas un prix fixe ?",
    answer:
      "Parce qu'un prix fixe annoncé sans connaître votre secteur, vos contenus et vos délais est faux. La fourchette situe le budget, le devis le précise.",
  },
  {
    question: "Le calculateur inclut-il les fichiers sources ?",
    answer:
      "Oui. Tous les niveaux comprennent les fichiers vectoriels et les exports nécessaires à l'impression et au web. Les fichiers de travail (calques, gabarits) sont remis sur demande.",
  },
  {
    question: "Combien de temps prend une identité visuelle ?",
    answer:
      "Cela dépend du périmètre et du nombre d'allers-retours. Le délai est annoncé au devis, il n'est pas inventé ici.",
  },
  {
    question: "Puis-je commencer par le logo et compléter plus tard ?",
    answer:
      "Oui, c'est fréquent. Sachez simplement qu'un niveau supérieur reprend le travail du précédent : compléter plus tard revient souvent plus cher que de monter d'un niveau tout de suite.",
  },
  {
    question: "Les prix sont-ils HT ?",
    answer: "Oui, les fourchettes sont exprimées hors taxes, avant application de la TVA.",
  },
  {
    question: "Que se passe-t-il après le calcul ?",
    answer:
      "Vous pouvez copier le récapitulatif et me l'envoyer depuis la page contact. Je réponds sous 24 heures ouvrées, avec un devis ou des questions de cadrage.",
  },
  {
    question: "Pourquoi un logo coûte plus cher que 200 € ?",
    answer:
      "Le temps de cadrage, de recherche et de déclinaisons, plus la cession des droits et la vérification d'antériorité.",
  },
  {
    question: "Peut-on créer son logo avec une IA ?",
    answer:
      "Oui pour explorer, non pour livrer tel quel. Une image générée n'est pas vectorielle, n'est pas testée en petit format, et ne règle ni l'unicité ni la cession des droits.",
  },
];

const FACTEURS = [
  {
    titre: "Le périmètre",
    texte:
      "Un logo, un logo décliné, une identité complète avec guide d'usage : ce ne sont pas les mêmes livrables, ni le même temps de conception.",
  },
  {
    titre: "Le point de départ",
    texte:
      "Repartir d'un logo existant coûte moins cher qu'une création complète : la recherche est plus courte. Refondre une identité entière coûte plus cher, parce qu'il faut auditer l'existant et migrer tous les supports.",
  },
  {
    titre: "Les déclinaisons",
    texte:
      "Chaque support supplémentaire demande des adaptations : formats, contraintes d'impression, lisibilité en petit.",
  },
  {
    titre: "L'accompagnement",
    texte:
      "Un projet livré avec explications et fichiers rangés coûte un peu plus qu'une simple remise de fichiers.",
  },
];

const TEMPS = [
  { etape: "Cadrage et brief", logo: "1 à 2 h", identite: "3 à 5 h" },
  { etape: "Recherche, marché, concurrence", logo: "2 à 4 h", identite: "4 à 8 h" },
  { etape: "Recherches graphiques et pistes", logo: "3 à 6 h", identite: "8 à 14 h" },
  { etape: "Allers-retours et ajustements", logo: "2 à 4 h", identite: "6 à 10 h" },
  { etape: "Déclinaisons et fichiers", logo: "2 à 3 h", identite: "6 à 10 h" },
  { etape: "Guide d'usage et transmission", logo: "0 à 1 h", identite: "3 à 5 h" },
];

const SOMMAIRE = [
  { href: "#principe", label: "Le principe" },
  { href: "#calculateur", label: "Le calculateur" },
  { href: "#niveaux", label: "Les niveaux" },
  { href: "#prix-logo", label: "Logo à 200 €" },
  { href: "#temps", label: "Le temps réel" },
  { href: "#logo-ia", label: "Logo et IA" },
  { href: "#faq", label: "Questions" },
];

export function CalculateurBudget() {
  return (
    <div>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1 className={styles.titre}>
              Combien coûte
              <br />
              une <span className={styles.accent}>identité visuelle</span> ?
            </h1>
            <p className="intro">
              Le prix d&apos;une identité visuelle dépend de trois choses : ce que vous avez déjà,
              ce que vous voulez obtenir, et la quantité de déclinaisons à produire. Cet outil
              vous donne une fourchette en trente secondes, à partir des tarifs réels du studio.
              Ce n&apos;est pas un devis, c&apos;est un ordre de grandeur pour savoir où vous
              mettez les pieds.
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
              <h2 id="principe">Ce que calcule cet outil</h2>
              <p>
                Trois minutes suffisent pour comprendre l&apos;essentiel : un logo seul ne coûte
                pas le prix d&apos;une identité complète, et une charte graphique n&apos;est pas un
                fichier PDF de dix pages. L&apos;outil additionne les postes que vous cochez et
                affiche une fourchette. Le devis, lui, se construit après un échange, parce que le
                prix dépend aussi de votre secteur, de vos délais et de qui fournit les textes et
                les photos.
              </p>

              <h2 id="calculateur">Le calculateur</h2>
              <BudgetIdentityCalculator />

              <h2>Ce qui fait varier le budget</h2>
              {FACTEURS.map((facteur) => (
                <p key={facteur.titre}>
                  <strong>{facteur.titre}.</strong> {facteur.texte}
                </p>
              ))}

              <h2 id="niveaux">Ce qui est inclus dans chaque niveau</h2>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className={styles.caption}>
                    Contenu des six niveaux et fourchettes associées, hors taxes.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Niveau</th>
                      <th scope="col" className={styles.price}>Fourchette</th>
                      <th scope="col">Ce qui est inclus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BASES.map((base) => (
                      <tr key={base.id}>
                        <th scope="row">{base.shortLabel}</th>
                        <td className={styles.price}>{formatRange(base.range)}</td>
                        <td>{base.includes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Les options</h3>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className={styles.caption}>
                    Options chiffrées, à ajouter au niveau retenu, hors taxes.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Option</th>
                      <th scope="col" className={styles.price}>Fourchette</th>
                    </tr>
                  </thead>
                  <tbody>
                    {OPTIONS.map((option) => (
                      <tr key={option.id}>
                        <th scope="row">{option.label}</th>
                        <td className={styles.price}>{formatRange(option.range)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={styles.note}>
                Les options s&apos;ajoutent au niveau retenu. Elles restent chiffrées séparément :
                vous pouvez en retirer une sans renégocier l&apos;ensemble.
              </p>

              <h2 id="prix-logo">Un logo à 200 € ou un logo de designer ?</h2>
              <p>
                Un logo à 200 € existe, et il rend service. Sur une place de marché, un concours de
                logos ou un générateur, vous obtenez un dessin en quelques heures, parfois joli,
                souvent suffisant pour une micro-activité qui teste une idée. Il faut juste savoir
                ce que vous achetez : un fichier, rarement les sources, presque jamais les
                déclinaisons, et aucune vérification d&apos;antériorité.
              </p>
              <p>
                Un designer ne vend pas un dessin, il vend une décision construite. Entretien de
                cadrage, analyse de votre marché et de vos concurrents, recherche de signes, trois
                pistes argumentées, ajustements après vos retours, déclinaisons techniques,
                fichiers propres, cession des droits. Ce travail prend du temps, et c&apos;est ce
                temps que vous payez.
              </p>

              <ComparaisonParcours />

              <h3 id="temps">Le temps réel d&apos;un projet</h3>
              <RepartitionTemps />
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className={styles.caption}>
                    Temps de travail estimé par étape, sur nos projets, hors échanges clients.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Étape</th>
                      <th scope="col" className={styles.price}>Logo seul</th>
                      <th scope="col" className={styles.price}>Identité complète</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEMPS.map((ligne) => (
                      <tr key={ligne.etape}>
                        <th scope="row">{ligne.etape}</th>
                        <td className={styles.price}>{ligne.logo}</td>
                        <td className={styles.price}>{ligne.identite}</td>
                      </tr>
                    ))}
                    <tr className={styles.total}>
                      <th scope="row">Total</th>
                      <td className={styles.price}>
                        <strong>10 à 20 h</strong>
                      </td>
                      <td className={styles.price}>
                        <strong>30 à 52 h</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p>
                Le détail palier par palier, avec ce qui manque dans un devis à 200 €, est
                détaillé dans le guide{" "}
                <Link href={routes.guidePrixLogo}>combien coûte un logo en 2026</Link>.
              </p>
              <p className={styles.note}>
                Ordre de grandeur sur nos projets. À un taux horaire de 60 à 80 €, on retrouve
                exactement les fourchettes affichées plus haut : 650 à 1 800 € pour un logo, 1 500
                à 3 500 € pour une identité complète. Le prix n&apos;est pas une humeur, c&apos;est
                du temps plus une méthode.
              </p>

              <h3>Ce que ça change pour vous</h3>
              <p>
                Un logo livré sans recherche ne tient pas longtemps. Il tient à l&apos;écran, puis
                il casse sur une carte de visite, sur un roll-up, en une seule couleur, en favicon.
                Chaque support refait coûte plus cher que le logo lui-même.
              </p>
              <figure className={styles.photo}>
                <img
                  src="/assets/img/papeterie-identite-960.webp"
                  alt="Papeterie de marque déclinée : papier à en-tête, carnet, enveloppe, carte de visite, écran de téléphone et clé USB."
                  width={960}
                  height={960}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption>
                  Papeterie de marque. C&apos;est ici qu&apos;un logo mal construit casse : petites
                  tailles, une seule couleur, contraintes d&apos;impression.
                </figcaption>
              </figure>
              <ul>
                <li>
                  <strong>Il tient partout.</strong> Testé en petit, en une couleur, sur fond clair
                  et sombre, avant livraison. C&apos;est la différence entre un visuel et un logo
                  utilisable.
                </li>
                <li>
                  <strong>Il est utilisable par vos prestataires.</strong> Fichiers vectoriels,
                  versions nommées, couleurs référencées. Un imprimeur ou un développeur ne perd pas
                  une heure à deviner vos fichiers.
                </li>
                <li>
                  <strong>Il est juridiquement à vous.</strong> Cession de droits écrite,
                  vérification d&apos;antériorité faite. Un logo non cédé ou déjà déposé par
                  quelqu&apos;un d&apos;autre peut vous coûter bien plus que 200 €.
                </li>
                <li>
                  <strong>Il dure.</strong> Un logo construit sur une méthode vieillit mieux
                  qu&apos;un effet de mode, et il évite la refonte à 18 mois, avec la réimpression de
                  tous les supports.
                </li>
              </ul>

              <h3>Quand 200 € suffisent</h3>
              <p>
                Il y a des cas où payer plus n&apos;a pas de sens : une activité en test, un projet
                personnel, un événement unique, un nom qui va changer. Dans ces cas, un logo simple
                et propre suffit, et je le dis. Ce n&apos;est pas une question de budget, c&apos;est
                une question de durée de vie attendue. Pour une marque que vous voulez garder dix
                ans, l&apos;écart de prix se rembourse au premier support refait.
              </p>

              <h2 id="logo-ia">Et un logo généré par une IA ?</h2>
              <p>
                Une IA produit vingt propositions en deux minutes. C&apos;est vrai, et c&apos;est
                utile. Pour explorer des directions, sortir d&apos;une ornière, tester une idée de
                symbole ou nourrir un moodboard, c&apos;est un accélérateur réel. Je m&apos;en sers,
                à cette étape précise du travail.
              </p>
              <p>
                La difficulté commence après. Une image générée est un dessin approximatif : elle
                n&apos;est pas vectorielle, la typographie est inventée et souvent bancale, les
                courbes sont irrégulières, et rien n&apos;a été testé à 16 px, en une couleur, sur
                fond sombre ou sur un roll-up. Il faut donc redessiner. Ce temps de reconstruction,
                c&apos;est précisément le travail du designer.
              </p>

              <IaVsDesigner />

              <h3>Ce qu&apos;une IA ne fait pas</h3>
              <ul>
                <li>
                  <strong>Elle ne dessine pas un vecteur propre.</strong> Un imprimeur ou un
                  façonnier ne travaille pas sur un PNG généré. Il faut redessiner le signe, ajuster
                  les courbes, harmoniser les graisses.
                </li>
                <li>
                  <strong>Elle ne compose pas une typographie.</strong> Les lettres générées sont des
                  imitations : approches irrégulières, lettres qui ne s&apos;alignent pas, accents
                  approximatifs. Un logotype se compose, il ne s&apos;improvise pas.
                </li>
                <li>
                  <strong>Elle ne garantit pas l&apos;unicité.</strong> Le modèle a appris sur des
                  marques existantes et peut produire un signe très proche d&apos;un logo déjà
                  déposé. Le risque n&apos;est pas théorique : opposition en nullité, refus de dépôt,
                  refonte en urgence.
                </li>
                <li>
                  <strong>Elle ne chaîne pas les droits.</strong> Vous ne savez pas ce qui a nourri
                  la génération, et une création purement générée n&apos;est pas protégeable de la
                  même façon qu&apos;une création humaine, selon les juridictions. Pour une marque,
                  c&apos;est un angle mort.
                </li>
                <li>
                  <strong>Elle ne construit pas un système.</strong> Un logo seul ne suffit pas : il
                  faut une palette qui tient en impression, des contrastes lisibles, des
                  déclinaisons cohérentes. L&apos;IA produit des images, pas une identité.
                </li>
              </ul>

              <h3>Ce que je fais avec l&apos;IA, concrètement</h3>
              <p>
                Trois usages, et trois seulement. L&apos;exploration en début de projet, pour sortir
                vite des évidences. Les variantes de déclinaison, pour visualiser un signe sur un
                support avant de le produire. La retouche et l&apos;illustration d&apos;accompagnement,
                quand la marque a besoin d&apos;images et pas de symboles. Le reste, dessin
                vectoriel, composition typographique, tests de lisibilité, cession de droits,
                vérification d&apos;antériorité, reste un travail humain.
              </p>
              <p>
                Un logo généré puis utilisé tel quel n&apos;est pas un logo pas cher. C&apos;est un
                logo à refaire, avec les supports déjà imprimés à jeter.
              </p>
              <p className={styles.note}>
                Si vous avez déjà des pistes générées et que vous voulez savoir si l&apos;une
                d&apos;elles est exploitable, envoyez-la : je vous dis franchement ce qui tient et
                ce qui ne tiendra pas. <Link href={routes.contact}>Envoyer une piste</Link>
              </p>

              <h2 id="faq">Questions fréquentes</h2>
              <div className="faq">
                {faqItems.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
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
              <p>Une fourchette, puis un devis.</p>
              <p className={styles.ctaText}>
                Le calcul situe le budget, le devis se construit sur votre périmètre.
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
    </div>
  );
}
