import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { JsonLd } from "@/components/site/JsonLd";
import {
  articleNode,
  breadcrumbNode,
  faqNode,
  pageGraph,
  webPageNode,
} from "@/lib/structured-data";
import styles from "./vtc.module.css";

const PATH = "/reussir-examen-vtc";
const SITE_URL = "https://sujeedesign.com";

const GUIDE_URL = "https://sujeedesign.gumroad.com/l/reussir-examen-vtc-2026";
const MEMO_URL = "https://sujeedesign.gumroad.com/l/fiches-memo-examen-vtc-2026";

const TITLE = "Réussir l'examen VTC 2026 en candidat libre";
const DESCRIPTION =
  "Le guide de révision de l'examen VTC 2026 écrit pour les candidats libres : les 7 épreuves, les seuils, un plan de 45 jours et 7 fiches mémo gratuites.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Le guide complet` },
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    images: [{ url: "/assets/vtc/guide-vtc-2026.png", width: 1280, height: 720 }],
  },
};

const epreuves = [
  { e: "A", nom: "Transport public particulier de personnes (T3P)", coef: "3", duree: "45 min", format: "10 QCM + 5 QRC" },
  { e: "B", nom: "Gestion d'entreprise", coef: "2", duree: "45 min", format: "16 QCM + 2 QRC" },
  { e: "C", nom: "Sécurité routière", coef: "3", duree: "30 min", format: "20 QCM" },
  { e: "D", nom: "Français", coef: "2", duree: "30 min", format: "7 QCM + 3 QRC" },
  { e: "E", nom: "Anglais", coef: "1", duree: "30 min", format: "20 QCM" },
  { e: "F(V)", nom: "Développement commercial", coef: "3", duree: "30 min", format: "12 QCM + 4 QRC" },
  { e: "G(V)", nom: "Réglementation spécifique VTC", coef: "3", duree: "20 min", format: "6 QCM + 2 QRC" },
];

const faq = [
  {
    q: "Peut-on passer l'examen VTC sans passer par un centre de formation ?",
    a: "Oui. Aucun texte n'impose de suivre une formation payante pour se présenter aux épreuves du titre professionnel VTC. Tu t'inscris auprès d'un organisme agréé, tu paies les frais d'examen et tu passes les épreuves. Le guide couvre le programme et la méthode, pas l'inscription administrative.",
  },
  {
    q: "Combien d'épreuves y a-t-il et combien de temps dure l'examen ?",
    a: "Sept épreuves écrites, pour 3 h 50 au total et un coefficient cumulé de 17, puis une épreuve pratique d'admission. Chaque épreuve écrite demande 6 sur 20 minimum, sauf l'anglais qui tolère 4 sur 20, et la moyenne pondérée doit atteindre 10 sur 20.",
  },
  {
    q: "Combien de temps faut-il pour réviser ?",
    a: "Le guide propose un plan de 45 jours à raison d'une heure trente par jour, et une version accélérée en 14 jours pour ceux qui passent dans trois semaines. En dessous de deux semaines, il faut viser les épreuves à fort coefficient et accepter de repasser les autres.",
  },
  {
    q: "Le guide remplace-t-il une formation ou un centre agréé ?",
    a: "Non, et il ne le prétend pas. C'est un ouvrage indépendant, sans lien avec un organisme agréé, un centre de formation ou une administration. Il sert à préparer les épreuves et à comprendre ce qui est noté, pas à délivrer un titre.",
  },
  {
    q: "Pourquoi proposer un site web à un chauffeur VTC ?",
    a: "Parce qu'un chauffeur indépendant vit de ses réservations directes. Un site avec zone d'intervention, tarifs et prise de contact coûte moins cher à l'année que la commission d'une plateforme, et il t'appartient. C'est une prestation de sujee design, indépendante du guide.",
  },
  {
    q: "Un site VTC est-il rentable face aux plateformes ?",
    a: "Sur une course de 30 €, une plateforme prélève 20 à 25 %. Un site à 39 € par mois est amorti dès la première ou la deuxième course directe du mois. L'objectif n'est pas de quitter les plateformes, c'est de récupérer les clients qui te connaissent déjà.",
  },
];

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, TITLE, DESCRIPTION),
          articleNode(
            PATH,
            TITLE,
            DESCRIPTION,
            "2026-11-12T09:00:00+01:00",
            "2026-11-12T09:00:00+01:00",
          ),
          faqNode(PATH, faq.map((f) => ({ question: f.q, answer: f.a }))),
          breadcrumbNode([
            { name: "Accueil", path: "/" },
            { name: TITLE, path: PATH },
          ]),
        ])}
      />

      <main id="main" className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Examen VTC · édition 2026</p>
            <h1>
              Passer l'examen VTC sans centre de formation
            </h1>
            <p className="intro">
              Sept épreuves écrites, une pratique, des seuils à connaître avant de réviser.{" "}
              <b>Le guide écrit pour ceux qui préparent seuls</b>, et le site web pour ceux qui passent de l'autre
              côté du volant.
            </p>
          </div>
        </div>

        <section className="section">
          <div className="wrap">
            <div className={styles.facts}>
              <div>
                <b>85</b>
                <span>pages</span>
              </div>
              <div>
                <b>14</b>
                <span>chapitres</span>
              </div>
              <div>
                <b>54</b>
                <span>chiffres réglementaires</span>
              </div>
              <div>
                <b>45</b>
                <span>jours de plan</span>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className={`legal ${styles.legal}`}>
              <nav className="toc" aria-label="Sommaire de la page">
                <span>Sommaire</span>
                <a href="#programme">Le programme</a>
                <a href="#seuils">Les seuils</a>
                <a href="#erreurs">Les quatre erreurs</a>
                <a href="#methode">La méthode des 45 jours</a>
                <a href="#contenu">Ce qu'il y a dedans</a>
              </nav>

              <div className="prose">
                <h2 id="programme">Ce que l'examen demande vraiment</h2>
                <p>
                  Un candidat libre ne se plante pas par manque de motivation. Il se plante parce qu'il révise au
                  hasard, sans savoir que deux épreuves pèsent un tiers de la note et que la pratique peut tout
                  annuler. Voici la grille réelle.
                </p>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Ép.</th>
                        <th>Matière</th>
                        <th>Coef.</th>
                        <th>Durée</th>
                        <th>Format</th>
                      </tr>
                    </thead>
                    <tbody>
                      {epreuves.map((row) => (
                        <tr key={row.e}>
                          <th scope="row">{row.e}</th>
                          <td>{row.nom}</td>
                          <td>{row.coef}</td>
                          <td>{row.duree}</td>
                          <td>{row.format}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h2 id="seuils">Les trois seuils qui décident</h2>
                <div className={styles.rules}>
                  <div>
                    <span className={styles.ruleNum}>6/20</span>
                    <p>
                      Note plancher par épreuve, sauf l'anglais qui tolère 4/20. Une épreuve sous le plancher
                      élimine, quel que soit le total.
                    </p>
                  </div>
                  <div>
                    <span className={styles.ruleNum}>10/20</span>
                    <p>
                      Moyenne pondérée exigée sur l'ensemble des écrits. Ce n'est pas la moyenne des notes, c'est
                      celle des coefficients.
                    </p>
                  </div>
                  <div>
                    <span className={styles.ruleNum}>12/20</span>
                    <p>
                      Note minimale à l'épreuve pratique. C'est l'admission : elle ne se rattrape pas avec de bons
                      écrits.
                    </p>
                  </div>
                </div>

                <h2 id="erreurs">Les quatre erreurs qui coûtent l'examen</h2>
                <ol className={styles.errors}>
                  <li>
                    <strong>Traiter les QRC comme des QCM.</strong> Les épreuves A, B, D, F et G contiennent des
                    questions à réponse courte, attendues en une phrase construite, pas en trois mots. C'est là que
                    se perdent les demi-points qui font passer de 9,5 à 10.
                  </li>
                  <li>
                    <strong>Préparer la pratique en dernier.</strong> Coefficient 3, note plancher 12 sur 20, double
                    commande et ajournement immédiat. Deux semaines suffisent pour un script d'accueil solide, à
                    condition de s'y prendre avant la dernière semaine.
                  </li>
                  <li>
                    <strong>Apprendre les chiffres en vrac.</strong> 54 chiffres réglementaires tombent en QCM. Sans
                    classement par thème, ils se mélangent le jour J. Le guide les range par épreuve et par famille
                    de délais.
                  </li>
                  <li>
                    <strong>Caler les révisions sur trois semaines.</strong> C'est possible, mais alors il faut
                    choisir les matières à fort coefficient et accepter de repasser le reste. Un plan de 45 jours
                    coûte moins cher qu'un deuxième passage à 170 €.
                  </li>
                </ol>

                <h2 id="methode">La méthode des 45 jours</h2>
                <p>
                  Une heure trente par jour, six semaines, un objectif par semaine. Le plan est écrit dans le livre,
                  jour par jour, y compris les jours de repos.
                </p>
                <div className={styles.weeks}>
                  <div><span>Semaine 1</span><p>Cadrer l'examen, démarrer la gestion et le développement commercial.</p></div>
                  <div><span>Semaine 2</span><p>Sécurité routière et réglementation spécifique, les deux matières les plus rentables.</p></div>
                  <div><span>Semaine 3</span><p>Français et anglais : rédactions chronométrées, vocabulaire du transport.</p></div>
                  <div><span>Semaine 4</span><p>Épreuve pratique : script d'accueil, parcours, questions du jury.</p></div>
                  <div><span>Semaine 5</span><p>Textes de loi, les 54 chiffres, un examen blanc complet chronométré.</p></div>
                  <div><span>Semaine 6</span><p>Consolidation, questions ratées uniquement, veille et logistique du jour J.</p></div>
                </div>

                <h2 id="contenu">Ce qu'il y a dans le guide</h2>
                <ul>
                  <li>Les sept épreuves écrites expliquées matière par matière, avec les QRC types et les erreurs classiques.</li>
                  <li>L'épreuve pratique de bout en bout : parcours, accueil en trois minutes, conduite notée, questions du jury.</li>
                  <li>54 chiffres réglementaires classés par thème, vérifiés au 11 novembre 2026.</li>
                  <li>Un lexique de 60 entrées et les huit textes de loi à connaître, avec ce qu'on te demandera dessus.</li>
                  <li>Un examen blanc de 40 QCM et 5 QRC, corrigé et commenté, pour te noter avant le jour J.</li>
                  <li>Le plan de révision sur 45 jours et la fiche du jour J : documents, horaires, pièges.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="offres">
          <div className="wrap">
            <div className="sec-head">
              <div className="sec-num">Deux offres</div>
              <div>
                <h2>Préparer l'examen, puis rouler</h2>
                <p>
                  Le guide pour passer les épreuves. Le site pour vivre de ton activité une fois la carte en poche.
                  Deux choses différentes, deux prix clairs.
                </p>
              </div>
              <div className="side">Sans frais cachés</div>
            </div>

            <div className={styles.offers}>
              <article className={styles.offer}>
                <p className={styles.offerKick}>Produit numérique · 19,90 €</p>
                <h3>Réussir l'examen VTC 2026</h3>
                <p className={styles.offerText}>
                  85 pages, 14 chapitres, PDF mis en page pour la lecture à l'écran et l'impression. Édition
                  novembre 2026, textes à jour.
                </p>
                <ul className={styles.offerList}>
                  <li>Les 7 épreuves écrites et la pratique</li>
                  <li>54 chiffres, lexique, textes de loi</li>
                  <li>Examen blanc corrigé et plan de 45 jours</li>
                  <li>Les 7 fiches mémo incluses</li>
                </ul>
                <p className={styles.promo}>
                  13,93 € avec le code <b>LANCEMENT-VTC</b> · 20 exemplaires jusqu'au 12/12/2026
                </p>
                <div className={styles.offerActions}>
                  <a className="btn-fill btn-fill--light" href={GUIDE_URL} target="_blank" rel="noopener">
                    Acheter le guide
                  </a>
                  <a className="btn-line btn-line--light" href={MEMO_URL} target="_blank" rel="noopener">
                    Les fiches gratuites
                  </a>
                </div>
                <p className={styles.fineprint}>
                  Paiement Gumroad · PDF immédiat · pas de rétractation après téléchargement
                </p>
              </article>

              <article className={`${styles.offer} ${styles.offerAlt}`}>
                <p className={styles.offerKick}>Prestation sujee design · abonnement</p>
                <h3>Ton site VTC, prêt à prendre des réservations</h3>
                <p className={styles.offerText}>
                  Un site vitrine qui t'appartient, pour récupérer les clients qui te connaissent déjà et arrêter de
                  payer une commission sur chaque course.
                </p>
                <p className={styles.price}>
                  39 €<span>par mois · au lieu de 59 €</span>
                </p>
                <ul className={styles.offerList}>
                  <li>Nom de domaine offert la première année</li>
                  <li>Hébergement et maintenance inclus</li>
                  <li>5 pages : accueil, services, tarifs, zone, contact</li>
                  <li>Mise en ligne en 15 jours ouvrés</li>
                  <li>Modifications de contenu incluses</li>
                </ul>
                <p className={styles.option}>
                  Option référencement local : <b>59 € par mois</b> au lieu de 99 €. Fiche Google, pages
                  optimisées, suivi des positions sur ta ville.
                </p>
                <div className={styles.offerActions}>
                  <Link className="btn-fill" href="/contact?projet=site-vtc">
                    Parler de mon site
                  </Link>
                  <a className={styles.linkArrow} href="#faq-site">
                    Voir les questions
                  </a>
                </div>
              </article>
            </div>

            <p className={styles.legalNote}>
              sujee design n'est ni un organisme de formation agréé, ni un centre d'examen, ni une administration.
              Le guide est un support de révision indépendant. La prestation site est un service distinct, engagé
              sur 12 mois, précédé d'un devis.
            </p>
          </div>
        </section>

        <section className="section" id="faq-site">
          <div className="wrap">
            <div className="sec-head">
              <div className="sec-num">Questions</div>
              <div>
                <h2>Ce qu'on nous demande le plus</h2>
              </div>
            </div>
            <div className={styles.faq}>
              {faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <p>Réussir l'examen d'abord. Le site ensuite.</p>
              <div className={styles.bandLinks}>
                <a className="btn-fill btn-fill--light" href={MEMO_URL} target="_blank" rel="noopener">
                  Les 7 fiches mémo, gratuit
                </a>
                <a className="btn-line btn-line--light" href={GUIDE_URL} target="_blank" rel="noopener">
                  Le guide complet, 19,90 €
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}
