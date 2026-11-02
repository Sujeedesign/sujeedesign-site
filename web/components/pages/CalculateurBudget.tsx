/**
 * Page /ressources/calculateur-budget-identite.
 *
 * Les textes sont ceux du brief P2 (`/opt/data/shared/briefs/P2-calculateur-budget-identite.md`),
 * recopiés sans reformulation. Tout le contenu éditorial (intro, méthode, facteurs, tableaux, FAQ)
 * est rendu par le serveur : le HTML initial contient les textes, le tableau des niveaux et la FAQ,
 * ce qui rend la page indexable même sans JavaScript. `BudgetIdentityCalculator` n'ajoute que le
 * calcul, côté navigateur.
 */
import Link from "next/link";
import { BudgetIdentityCalculator } from "@/components/BudgetIdentityCalculator";
import { BASES, OPTIONS, formatRange } from "@/lib/budget-identity";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./CalculateurBudget.module.css";

export const pageMeta = {
  title: "Calculateur de budget identité visuelle",
  description:
    "Estimez en 30 secondes le budget d'une identité visuelle : logo, charte, déclinaisons, papeterie. Fourchettes réelles, sans engagement.",
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
      "Oui, c'est fréquent. Sachez simplement qu'une charte conçue après coup coûte un peu plus cher que si elle est pensée en même temps que le logo.",
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
      "Partir d'une page blanche coûte moins cher qu'une refonte, où il faut d'abord comprendre et démonter l'existant.",
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

export function CalculateurBudget() {
  return (
    <>
      <div>
        <header className="page">
          <div className="wrap">
            <div className="page-head">
              <p className="kick">Ressources</p>
              <h1>
                Combien coûte
                <br />
                une identité visuelle ?
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

        <section>
          <div className="wrap">
            <div className={styles.layout}>
              <div className={styles.main}>
                <h2>Ce que calcule cet outil</h2>
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
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="wrap">
            <div className={styles.layout}>
              <div className={styles.main}>
                <h2>Ce qui fait varier le budget</h2>
                {FACTEURS.map((facteur) => (
                  <p key={facteur.titre}>
                    <strong>{facteur.titre}.</strong> {facteur.texte}
                  </p>
                ))}

                <h2>Ce qui est inclus dans chaque niveau</h2>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className={styles.caption}>
                      Contenu des quatre niveaux et fourchettes associées, hors taxes.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Niveau</th>
                        <th scope="col">Fourchette</th>
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
                        <th scope="col">Fourchette</th>
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
                  La charte graphique détaillée est déjà incluse dans l&apos;identité complète et
                  dans la refonte : elle n&apos;est donc pas proposée en option pour ces deux
                  niveaux.
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
        </section>

        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p>Une fourchette, puis un devis.</p>
              <p className={styles.ctaText}>
                Le calcul situe le budget, le devis se construit sur votre périmètre. Deux façons
                de continuer :
              </p>
              <div className={styles.ctaLinks}>
                <Link className="btn-fill btn-fill--light" href={routes.contact}>
                  Parler de votre projet <span aria-hidden="true">↗</span>
                </Link>
                <Link className="btn-line" href={serviceHref("identite-de-marque")}>
                  Voir l&apos;offre identité de marque
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
