import Link from "next/link";
import Faq from "@/components/Faq";
import { IdentiteBriefGenerator } from "@/components/IdentiteBriefGenerator";
import { routes, serviceHref } from "@/lib/routes";
import { STEPS } from "@/lib/logo-brief";
import styles from "./GenerateurBrief.module.css";
import { CoverFigure } from "./CoverFigure";

export const pageMeta = {
  title: "Générateur de brief logo et identité",
  description:
    "Dix questions, quatre minutes, un brief imprimable en PDF. Ce qu'un studio doit savoir avant de dessiner, et les erreurs qui coûtent un aller-retour.",
};

export const faqItems = [
  {
    question: "Faut-il remplir toutes les questions ?",
    answer:
      "Non. Sept points sont essentiels : l'activité, la promesse, les clients, la différenciation, trois adjectifs, les supports et une fourchette de budget. Les autres précisent le travail sans le bloquer.",
  },
  {
    question: "Mes réponses sont-elles envoyées au studio ?",
    answer:
      "Non. Le formulaire fonctionne entièrement dans votre navigateur. Rien n'est transmis, enregistré ni relu tant que vous ne collez pas le brief dans un mail ou ne nous l'envoyez pas vous-même.",
  },
  {
    question: "Le brief remplace-t-il le devis ?",
    answer:
      "Non. Le brief décrit ce que vous voulez obtenir. Le devis chiffre le périmètre : nombre de pistes, déclinaisons, supports, délais. L'un prépare l'autre.",
  },
  {
    question: "Peut-on partir d'un logo existant ?",
    answer:
      "Oui. Précisez dans la question 9 si le logo doit être conservé, modernisé ou remplacé, et si vous disposez des fichiers vectoriels. Sans fichiers sources, une reprise commence par une reconstruction.",
  },
  {
    question: "Combien de temps prend la rédaction d'un brief ?",
    answer:
      "Quatre à dix minutes avec ce formulaire. Un brief écrit à la main prend souvent une heure et oublie la moitié des points.",
  },
  {
    question: "Faut-il un brief pour une carte de visite seule ?",
    answer:
      "Un brief allégé suffit : la question du positionnement reste utile, mais les déclinaisons et l'enseigne ne comptent pas. Le générateur accepte les réponses partielles.",
  },
];

const SOMMAIRE = [
  { href: "#outil", label: "L'outil" },
  { href: "#questions", label: "Les dix questions" },
  { href: "#erreurs", label: "Quatre erreurs" },
  { href: "#suite", label: "Après le brief" },
  { href: "#faq", label: "Questions fréquentes" },
];

const ERREURS = [
  {
    title: "Confondre goûts et positionnement",
    text:
      "« J'aime le bleu » renseigne sur vous, pas sur vos clients. Un brief utile dit à qui vous parlez et ce que vous voulez qu'ils retiennent.",
  },
  {
    title: "Demander dix adjectifs",
    text:
      "Sobre, premium, chaleureux, moderne, artisanal, international : la liste se contredit et le résultat retombe sur un logo neutre.",
  },
  {
    title: "Oublier les supports",
    text:
      "Un logo lisible sur un écran peut disparaître sur une enseigne, en un seul ton, ou dans un favicon de seize pixels. Le brief doit nommer les usages.",
  },
  {
    title: "Annoncer une date sans marge",
    text:
      "Une échéance qui ne laisse aucun temps pour les retours transforme un projet propre en urgence. Mieux vaut décaler le lancement que livrer sans vérifier.",
  },
];

export function GenerateurBrief() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1 className={styles.titre}>
              Générateur
              <br />
              de <span className={styles.accent}>brief</span> identité
            </h1>
            <p className="intro">
              Dix questions, quatre minutes, un brief que vous pouvez imprimer en PDF. Le même
              document sert à demander un devis, à comparer deux studios, ou à cadrer un projet que
              vous ferez vous-même.
            </p>
          </div>
        </div>
      </header>

      <section className="section" id="outil">
        <div className="wrap">
          <div className={styles.conteneur}>
            <IdentiteBriefGenerator />

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
                  slug="brief-identite"
                  alt="Ordinateur portable affichant un formulaire de brief identité avec export PDF, sur un bureau."
                  caption="Dix questions, un document, et le brief est écrit. L'export PDF se fait depuis la page, sans compte à créer."
                />
                <h2 id="questions">Les dix questions, et pourquoi elles existent</h2>
                <p>
                  Un brief n&apos;est pas un formulaire administratif. Chaque question ferme une
                  porte ouverte : celles par lesquelles arrivent les allers-retours coûteux.
                </p>

                <ul className={styles.questions}>
                  {STEPS.map((step) => (
                    <li key={step.title} className={styles.question}>
                      <span className={styles.num}>{String(step.num).padStart(2, "0")}</span>
                      <div>
                        <p className={styles.questionTitle}>{step.title}</p>
                        <p className={styles.questionBody}>
                          <strong>Pourquoi :</strong> {step.why}
                        </p>
                        <p className={styles.questionBody}>
                          <strong>L&apos;erreur classique :</strong> {step.error}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <h2 id="erreurs">Quatre erreurs qui coûtent un aller-retour</h2>
                <ul className={styles.erreurs}>
                  {ERREURS.map((erreur) => (
                    <li key={erreur.title} className={styles.erreur}>
                      <p className={styles.erreurTitle}>{erreur.title}</p>
                      <p className={styles.erreurText}>{erreur.text}</p>
                    </li>
                  ))}
                </ul>

                <h2 id="suite">Ce qu&apos;on fait du brief</h2>
                <p>
                  Une fois le document en main, on vérifie trois choses : la cohérence entre la
                  promesse et les adjectifs, la faisabilité sur les supports cochés, et le niveau de
                  finition que la fourchette de budget permet réellement. C&apos;est à ce moment
                  qu&apos;on sait si le projet tient dans un logo, une identité complète, ou une
                  refonte de l&apos;existant.
                </p>
                <p>
                  Si vous voulez situer le budget avant de nous écrire, le{" "}
                  <Link href={routes.calculateurBudgetIdentite}>calculateur d&apos;identité</Link>{" "}
                  donne une fourchette en trente secondes. Le{" "}
                  <Link href={routes.guidePrixLogo}>guide des prix du logo</Link> détaille ce que
                  chaque palier contient.
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
              <p>Votre brief est prêt ?</p>
              <p className={styles.ctaText}>
                Envoyez-le tel quel. On répond avec un périmètre, un calendrier et une fourchette,
                pas avec une plaquette.
              </p>
            </div>
            <div className={styles.ctaLinks}>
              <Link className="btn-fill btn-fill--light" href={routes.contact}>
                Envoyer mon brief <span aria-hidden="true">↗</span>
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
