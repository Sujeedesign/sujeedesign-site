import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/site/PageShell";
import { JsonLd } from "@/components/site/JsonLd";
import VtcStickyBar from "@/components/pages/VtcStickyBar";
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

/** Une seule ligne à changer quand la nouvelle édition sort. */
const EDITION = "2027";

/** Lien sans code promo : Gumroad ouvre le paiement au prix plein, 19,90 € TTC.
    Un seul prix, pas d'offre datée, pas de code à saisir. */
const GUIDE_URL = "https://sujeedesign.gumroad.com/l/reussir-examen-vtc-2026";
const MEMO_URL = "https://sujeedesign.gumroad.com/l/fiches-memo-examen-vtc-2026";

const TITLE = `Examen VTC ${EDITION} : réussir en candidat libre`;
const DESCRIPTION = `Les 7 épreuves, les 3 seuils et un plan de 45 jours pour réussir l’examen VTC ${EDITION} seul. 7 fiches mémo gratuites, guide complet à 19,90 €.`;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Guide et PDF` },
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    type: "article",
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    images: [{ url: "/assets/vtc/chauffeur-mercedes.webp", width: 1800, height: 1344 }],
  },
};

const epreuves = [
  { e: "A", nom: "Transport public particulier de personnes (T3P)", coef: "3", duree: "45 min", format: "10 QCM + 5 QRC" },
  { e: "B", nom: "Gestion d’entreprise", coef: "2", duree: "45 min", format: "16 QCM + 2 QRC" },
  { e: "C", nom: "Sécurité routière", coef: "3", duree: "30 min", format: "20 QCM" },
  { e: "D", nom: "Français", coef: "2", duree: "30 min", format: "7 QCM + 3 QRC" },
  { e: "E", nom: "Anglais", coef: "1", duree: "30 min", format: "20 QCM" },
  { e: "F(V)", nom: "Développement commercial", coef: "3", duree: "30 min", format: "12 QCM + 4 QRC" },
  { e: "G(V)", nom: "Réglementation spécifique VTC", coef: "3", duree: "20 min", format: "6 QCM + 2 QRC" },
];

const seuils = [
  {
    note: "6/20",
    label: "Par épreuve",
    texte:
      "Note plancher sur chaque écrit, sauf l’anglais qui tolère 4/20. Une épreuve sous le plancher élimine, quel que soit le total.",
  },
  {
    note: "10/20",
    label: "Moyenne pondérée",
    texte:
      "Moyenne exigée sur l’ensemble des écrits. Ce n’est pas la moyenne des notes, c’est celle des coefficients.",
  },
  {
    note: "12/20",
    label: "Épreuve pratique",
    texte:
      "Note minimale à la pratique. C’est l’admission : elle ne se rattrape pas avec de bons écrits.",
  },
];

const erreurs = [
  {
    titre: "Traiter les QRC comme des QCM",
    texte:
      "Cinq épreuves sur sept contiennent des questions à réponse courte, attendues en une phrase construite. C’est là que se perdent les demi-points qui font passer de 9,5 à 10.",
  },
  {
    titre: "Préparer la pratique en dernier",
    texte:
      "Coefficient 3, note plancher 12 sur 20, double commande et ajournement immédiat. Deux semaines suffisent pour un script d’accueil solide, à condition de s’y prendre avant la dernière semaine.",
  },
  {
    titre: "Apprendre les chiffres en vrac",
    texte:
      "Les chiffres réglementaires tombent en QCM. Sans classement par thème, ils se mélangent le jour J. Le guide les range par épreuve et par famille de délais.",
  },
  {
    titre: "Caler les révisions sur trois semaines",
    texte:
      "C’est possible, mais il faut choisir les matières à fort coefficient et accepter de repasser le reste. Un plan de 45 jours coûte moins cher qu’un deuxième passage à l’examen.",
  },
];

const semaines = [
  { s: "Semaine 1", t: "Cadrer l’examen, démarrer la gestion et le développement commercial." },
  { s: "Semaine 2", t: "Sécurité routière et réglementation spécifique, les deux matières les plus rentables." },
  { s: "Semaine 3", t: "Français et anglais : rédactions chronométrées, vocabulaire du transport." },
  { s: "Semaine 4", t: "Épreuve pratique : script d’accueil, parcours, questions du jury." },
  { s: "Semaine 5", t: "Textes de loi, les chiffres clés, un examen blanc complet chronométré." },
  { s: "Semaine 6", t: "Consolidation, questions ratées uniquement, veille et logistique du jour J." },
];

const contenuGuide = [
  "Les sept épreuves écrites expliquées matière par matière, avec les QRC types et les erreurs classiques.",
  "L’épreuve pratique de bout en bout : parcours, accueil en trois minutes, conduite notée, questions du jury.",
  "Les chiffres réglementaires classés par thème, vérifiés au 11 novembre 2026.",
  "Un lexique de 60 entrées et les huit textes de loi à connaître, avec ce qu’on te demandera dessus.",
  "Un examen blanc de 40 QCM et 5 QRC, corrigé et commenté, pour te noter avant le jour J.",
  "Le plan de révision sur 45 jours et la fiche du jour J : documents, horaires, pièges.",
];

const contenuMemo = [
  "Une fiche par épreuve, A à G : l’essentiel à relire la veille.",
  "Les seuils et les coefficients rappelés en haut de chaque page.",
  "Les pièges classiques des QRC, avec la formulation attendue.",
  "Format A4, à imprimer ou à garder sur le téléphone.",
];

const livrables = [
  {
    n: "01",
    titre: "Le cadrage",
    texte:
      "Trente minutes au téléphone : ton activité, ta zone, ta clientèle. On arrête le nom, le ton et la direction visuelle.",
  },
  {
    n: "02",
    titre: "La production",
    texte:
      "Site et supports avancent ensemble. Deux allers-retours inclus, sans réunion à rallonge.",
  },
  {
    n: "03",
    titre: "La mise en ligne",
    texte:
      "Domaine, hébergement, formulaire de réservation, fiche Google. Tout est testé sur mobile avant d’ouvrir.",
  },
  {
    n: "04",
    titre: "La livraison",
    texte:
      "Fichiers sources, flyers imprimés, accès au site. Tu repars autonome, je reste joignable.",
  },
];

const faq = [
  {
    q: "Peut-on passer l’examen VTC sans passer par un centre de formation ?",
    a: "Oui. Aucun texte n’impose de suivre une formation payante pour se présenter aux épreuves du titre professionnel VTC. Tu t’inscris auprès de la CMA de ta région, tu paies les frais d’examen et tu passes les épreuves. Le guide couvre le programme et la méthode, pas l’inscription administrative.",
  },
  {
    q: "L’expérience professionnelle permet-elle encore d’éviter l’examen ?",
    a: "Non. Depuis le 12 août 2026, l’expérience professionnelle ne permet plus d’accéder à la profession de chauffeur VTC : l’examen est devenu l’unique voie d’accès. Seules les demandes de carte professionnelle déposées avant cette date échappent à l’obligation.",
  },
  {
    q: "Combien coûte l’inscription à l’examen VTC ?",
    a: "Comptez environ 200 € pour l’inscription auprès de la CMA de ta région, payables en ligne. Ces frais ne sont pas remboursés une fois l’inscription validée, et un écrit raté se repasse en repayant l’inscription. À cela s’ajoute, pour exercer à ton compte, l’inscription au registre des VTC (environ 170 €, à renouveler tous les cinq ans).",
  },
  {
    q: "Combien d’épreuves y a-t-il et combien de temps dure l’examen ?",
    a: "Sept épreuves écrites, pour 3 h 50 au total et un coefficient cumulé de 17, puis une épreuve pratique d’admission. Chaque épreuve écrite demande 6 sur 20 minimum, sauf l’anglais qui tolère 4 sur 20, et la moyenne pondérée doit atteindre 10 sur 20.",
  },
  {
    q: "Combien de temps faut-il pour réviser ?",
    a: "Le guide propose un plan de 45 jours à raison d’une heure trente par jour, et une version accélérée en 14 jours pour ceux qui passent dans trois semaines. En dessous de deux semaines, il faut viser les épreuves à fort coefficient et accepter de repasser les autres.",
  },
  {
    q: "Le guide remplace-t-il une formation ou un centre agréé ?",
    a: "Non, et il ne le prétend pas. C’est un ouvrage indépendant, sans lien avec un organisme agréé, un centre de formation ou une administration. Il sert à préparer les épreuves et à comprendre ce qui est noté, pas à délivrer un titre.",
  },
  {
    q: "Comment se passe la commande et le téléchargement ?",
    a: "Le paiement se fait sur Gumroad, par carte. Le PDF est disponible immédiatement après l’achat, sans compte à créer, et le lien de téléchargement reste accessible depuis la confirmation de commande. Comme pour tout contenu numérique, il n’y a pas de rétractation après téléchargement.",
  },
  {
    q: "Que comprend exactement l’offre à 39 € par mois ?",
    a: "Le nom de domaine offert la première année, un site de cinq pages avec formulaire de réservation, un flyer A5 et une carte de visite à la même direction visuelle, l’hébergement et la maintenance. Un seul interlocuteur, un seul calendrier. 490 € de mise en service une seule fois, puis 39 € par mois, engagement de douze mois.",
  },
  {
    q: "Pourquoi un abonnement plutôt qu’un paiement unique ?",
    a: "Parce qu’un site ne s’arrête pas le jour de la livraison : il y a l’hébergement, les mises à jour, les changements de tarifs, la nouvelle photo du véhicule. Les 490 € couvrent la production, les 39 € par mois couvrent la vie du site.",
  },
  {
    q: "Faut-il déjà avoir la carte VTC pour commander ?",
    a: "Non, et c’est même le bon moment. Le site et les supports peuvent se préparer pendant les révisions, pour être en ligne le jour où tu commences à rouler. La prestation est indépendante du guide : elle démarre par un devis et un rendez-vous de cadrage.",
  },
];

export default function Page() {
  const faqExamen = faq.slice(0, 7);
  const faqSite = faq.slice(7);

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
            "2026-11-12T18:00:00+01:00",
          ),
          {
            "@type": "Product",
            "@id": `${SITE_URL}${PATH}#guide`,
            name: `Réussir l’examen VTC ${EDITION}`,
            description:
              "Manuel de 85 pages pour préparer seul les 7 épreuves de l’examen VTC, avec examen blanc corrigé et plan de révision de 45 jours.",
            image: `${SITE_URL}/assets/vtc/guide-vtc-2027.webp`,
            brand: { "@type": "Brand", name: "Sujee Design" },
            category: "Livre numérique",
            offers: {
              "@type": "Offer",
              url: GUIDE_URL,
              price: "19.90",
              priceCurrency: "EUR",
              availability: "https://schema.org/InStock",
              seller: { "@id": `${SITE_URL}/#studio` },
            },
          },
          faqNode(PATH, faq.map((f) => ({ question: f.q, answer: f.a }))),
          breadcrumbNode([
            { name: "Accueil", path: "/" },
            { name: TITLE, path: PATH },
          ]),
        ])}
      />

      <main id="main" className={styles.page}>
        {/* 1. Hero sombre, photo pleine largeur */}
        <section className={styles.hero}>
          <div className={styles.heroMedia} aria-hidden="true">
            <img
              src="/assets/vtc/chauffeur-mercedes.webp"
              alt=""
              width={1800}
              height={1344}
              fetchPriority="high"
            />
          </div>
          <div className={styles.heroGrain} aria-hidden="true" />

          <div className={`wrap ${styles.heroInner}`}>
            <div className={styles.heroCopy}>
              <p className={styles.kick}>Édition {EDITION} · candidat libre</p>
              <h1 className={styles.heroTitle}>
                Réussir l’examen VTC {EDITION}
                <span className={styles.heroThin}>sans centre de formation</span>
              </h1>
              <p className={styles.heroLead}>
                Depuis le 12 août 2026, l’examen est la seule voie pour devenir chauffeur VTC.
                <b> Le guide écrit pour ceux qui préparent seuls</b> : 85 pages, 14 chapitres, un
                plan de 45 jours. Et les 7 fiches mémo en PDF, pour commencer ce soir.
              </p>

              <div className={styles.heroCta}>
                <a className={styles.btnSolid} href={MEMO_URL} target="_blank" rel="noopener">
                  Télécharger le PDF gratuit
                  <span aria-hidden="true">↘</span>
                </a>
                <a className={styles.btnGhost} href={GUIDE_URL} target="_blank" rel="noopener">
                  Le guide complet · 19,90 €
                </a>
              </div>

              <p className={styles.heroMicro}>
                7 fiches offertes, une par épreuve · PDF livré immédiatement · paiement par carte
              </p>

              <div className={styles.heroProof}>
                <div>
                  <b>7</b>
                  <span>épreuves écrites</span>
                </div>
                <div>
                  <b>17</b>
                  <span>coefficients</span>
                </div>
                <div>
                  <b>45</b>
                  <span>jours de plan</span>
                </div>
                <div>
                  <b>3</b>
                  <span>seuils à connaître</span>
                </div>
              </div>
            </div>

            <div className={styles.heroAside}>
              <figure className={styles.heroCard}>
                <img
                  src="/assets/vtc/guide-vtc-2027-700.webp"
                  alt="Couverture du guide Réussir l’examen VTC, édition 2027, manuel de préparation pour candidat libre."
                  width={700}
                  height={988}
                />
                <figcaption>
                  <span>Le guide</span>
                  85 pages · PDF immédiat
                </figcaption>
              </figure>
              <a className={styles.heroJump} href="#site">
                Chauffeur déjà en activité ?
                <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>
        </section>

        {/* 2. Bandeau défilant */}
        <div className={styles.marquee} aria-hidden="true">
          <div className={styles.marqueeTrack}>
            <span>7 épreuves</span>
            <span>✳</span>
            <span>3 seuils</span>
            <span>✳</span>
            <span>45 jours</span>
            <span>✳</span>
            <span>85 pages</span>
            <span>✳</span>
            <span>PDF gratuit</span>
            <span>✳</span>
            <span>0 € de commission</span>
            <span>✳</span>
            <span>7 épreuves</span>
            <span>✳</span>
            <span>3 seuils</span>
            <span>✳</span>
            <span>45 jours</span>
            <span>✳</span>
            <span>85 pages</span>
            <span>✳</span>
            <span>PDF gratuit</span>
            <span>✳</span>
            <span>0 € de commission</span>
            <span>✳</span>
          </div>
        </div>

        {/* 3. Deux parcours */}
        <section className={styles.segSection} id="parcours">
          <div className="wrap">
            <div className={styles.segHead}>
              <p className={styles.eyebrow}>Deux situations, deux réponses</p>
              <h2 className={styles.segTitle}>Tu en es où, exactement ?</h2>
            </div>
            <div className={styles.segGrid}>
              <a className={styles.segCard} href="#examen">
                <span className={styles.segImg}>
                  <img
                    src="/assets/vtc/business-backseat-900.webp"
                    alt="Passager travaillant sur son ordinateur à l’arrière d’une berline."
                    width={900}
                    height={1350}
                    loading="lazy"
                  />
                </span>
                <span className={styles.segBody}>
                  <span className={styles.segNum}>01 · Je prépare l’examen</span>
                  <span className={styles.segName}>Candidat libre</span>
                  <span className={styles.segText}>
                    Tu révises seul, l’examen est dans quelques semaines. Commence par le PDF
                    gratuit, prends le guide si tu veux la méthode complète.
                  </span>
                  <span className={styles.segCta}>Fiches gratuites, puis guide →</span>
                </span>
              </a>

              <a className={styles.segCard} href="#site">
                <span className={styles.segImg}>
                  <img
                    src="/assets/vtc/driver-suit-900.webp"
                    alt="Chauffeur en costume au volant d’une berline, vu de l’arrière."
                    width={900}
                    height={1350}
                    loading="lazy"
                  />
                </span>
                <span className={styles.segBody}>
                  <span className={styles.segNum}>02 · Je veux des clients</span>
                  <span className={styles.segName}>Chauffeur en activité</span>
                  <span className={styles.segText}>
                    Tu as la carte, ou tu l’auras bientôt. Il te faut un nom, un site et de quoi te
                    présenter. Le pack clé en main est fait pour ça.
                  </span>
                  <span className={styles.segCta}>Site clé en main · 39 €/mois →</span>
                </span>
              </a>
            </div>
          </div>
        </section>

        {/* 4. Le problème et le programme */}
        <section className={styles.lightSection} id="examen">
          <div className="wrap">
            <div className="sec-head">
              <div className="sec-num">Ce qui bloque</div>
              <div>
                <h2>Quatre erreurs éliminatoires, avant même la note</h2>
                <p>
                  Un candidat libre ne se plante pas par manque de motivation. Il se plante parce
                  qu’il révise au hasard, sans savoir que deux épreuves pèsent un tiers de la note
                  et que la pratique peut tout annuler.
                </p>
              </div>
              <div className="side">Rien à voir avec le niveau</div>
            </div>

            <ol className={styles.errors}>
              {erreurs.map((item) => (
                <li key={item.titre}>
                  <strong>{item.titre}.</strong> {item.texte}
                </li>
              ))}
            </ol>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <caption className={styles.caption}>
                  Les sept épreuves écrites, coefficients et durées : 3 h 50 au total.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Ép.</th>
                    <th scope="col">Matière</th>
                    <th scope="col">Coef.</th>
                    <th scope="col">Durée</th>
                    <th scope="col">Format</th>
                  </tr>
                </thead>
                <tbody>
                  {epreuves.map((row) => (
                    <tr key={row.e}>
                      <th scope="row" className={styles.epCode}>
                        {row.e}
                      </th>
                      <td data-label="Matière">{row.nom}</td>
                      <td data-label="Coefficient" className={styles.num}>
                        {row.coef}
                      </td>
                      <td data-label="Durée" className={styles.num}>
                        {row.duree}
                      </td>
                      <td data-label="Format">{row.format}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.thresholds}>
              {seuils.map((seuil) => (
                <div key={seuil.note}>
                  <span className={styles.thLabel}>{seuil.label}</span>
                  <b className={styles.thNum}>{seuil.note}</b>
                  <p>{seuil.texte}</p>
                </div>
              ))}
            </div>

            <h3 className={styles.subHead}>Le plan des 45 jours</h3>
            <p className={styles.bodyText}>
              Une heure trente par jour, six semaines, un objectif par semaine. Le plan est écrit
              dans le livre, jour par jour, y compris les jours de repos.
            </p>
            <div className={styles.weeks}>
              {semaines.map((semaine) => (
                <div key={semaine.s}>
                  <span>{semaine.s}</span>
                  <p>{semaine.t}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Le PDF gratuit */}
        <section className={styles.magnetSection} id="pdf-gratuit">
          <div className={styles.magnetGrain} aria-hidden="true" />
          <div className={`wrap ${styles.magnet}`}>
            <figure className={styles.magnetFig}>
              <img
                src="/assets/vtc/fiches-memo-2027-700.webp"
                alt="Couverture des 7 fiches mémo de l’examen VTC 2027, une page par épreuve, format A4."
                width={700}
                height={992}
                loading="lazy"
              />
            </figure>
            <div className={styles.magnetText}>
              <p className={styles.kick}>Gratuit · sans condition</p>
              <h2 className={styles.magnetTitle}>
                Les 7 fiches mémo,
                <span>une par épreuve</span>
              </h2>
              <p>
                Une page A4 par épreuve, à imprimer ou à garder sur le téléphone : les
                coefficients, les seuils, les QRC types et les pièges à relire la veille. C’est ce
                que tu aurais aimé avoir avant de réviser au hasard.
              </p>
              <ul className={styles.offerList}>
                {contenuMemo.map((ligne) => (
                  <li key={ligne}>{ligne}</li>
                ))}
              </ul>
              <a className={styles.btnSolid} href={MEMO_URL} target="_blank" rel="noopener">
                Recevoir le PDF gratuit
                <span aria-hidden="true">↘</span>
              </a>
              <p className={styles.magnetMicro}>0 € · lien immédiat · aucun abonnement</p>
            </div>
          </div>
        </section>

        {/* 6. Le guide */}
        <section className={styles.lightSection} id="guide">
          <div className="wrap">
            <div className="sec-head">
              <div className="sec-num">Le guide</div>
              <div>
                <h2>Ce qu’il y a dans les 85 pages</h2>
                <p>
                  Les fiches donnent les repères. Le guide donne la méthode complète : chaque
                  épreuve, les réponses attendues, l’entraînement et le calendrier jusqu’au jour J.
                </p>
              </div>
              <div className="side">PDF · 19,90 € TTC</div>
            </div>

            <div className={styles.guideGrid}>
              <ul className={styles.contentList}>
                {contenuGuide.map((ligne) => (
                  <li key={ligne}>{ligne}</li>
                ))}
              </ul>

              <article className={styles.offerPdf}>
                <p className={styles.offerKick}>Produit numérique · PDF immédiat</p>
                <h3>Réussir l’examen VTC {EDITION}</h3>
                <p className={styles.offerText}>
                  85 pages, 14 chapitres, mise en page pour la lecture à l’écran et pour
                  l’impression. Édition novembre 2026, textes à jour.
                </p>
                <p className={styles.price}>
                  19,90 €<span className={styles.priceUnit}>TTC</span>
                </p>
                <p className={styles.promoNote}>
                  Prix unique. Pas de code, pas d’offre qui expire.
                </p>
                <a className={styles.btnSolid} href={GUIDE_URL} target="_blank" rel="noopener">
                  Acheter le guide
                  <span aria-hidden="true">↘</span>
                </a>
                <a className={styles.textLink} href={MEMO_URL} target="_blank" rel="noopener">
                  Ou commencer par les fiches gratuites
                </a>
                <ul className={styles.offerList}>
                  <li>Les 7 épreuves écrites et la pratique, matière par matière</li>
                  <li>Chiffres réglementaires, lexique, huit textes de loi</li>
                  <li>Examen blanc corrigé et plan de 45 jours, jour par jour</li>
                  <li>Les 7 fiches mémo incluses</li>
                </ul>
                <p className={styles.fineprint}>
                  Prix TTC, TVA 20 % incluse · paiement Gumroad · PDF disponible immédiatement ·
                  pas de rétractation après téléchargement
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* 7. L'offre clé en main */}
        <section className={styles.siteSection} id="site">
          <div className={`wrap ${styles.siteInner}`}>
            <div className={styles.siteCopy}>
              <p className={styles.kick}>Prestation sujee design · chauffeurs VTC</p>
              <h2 className={styles.siteTitle}>
                Ton activité, clé en main.
                <span>Domaine, site, flyer.</span>
              </h2>
              <p className={styles.siteLead}>
                Passer l’examen, c’est une chose. Être trouvé le lendemain, c’en est une autre. Un
                seul abonnement, un seul interlocuteur, et tout ce qu’il faut pour exister face aux
                plateformes : ton nom, ton image, ton site, tes supports.
              </p>

              <div className={styles.steps}>
                {livrables.map((l) => (
                  <div className={styles.step} key={l.n}>
                    <span className={styles.stepNum}>{l.n}</span>
                    <h3>{l.titre}</h3>
                    <p>{l.texte}</p>
                  </div>
                ))}
              </div>

              <div className={styles.siteFoot}>
                <p className={styles.siteNote}>
                 490 € de mise en service · engagement 12 mois · option référencement local
                 +49 €/mois.
                </p>
                <Link className={styles.textLink} href="/realisations">
                  Voir des exemples de sites livrés
                </Link>
              </div>
            </div>

            <aside className={styles.packCard}>
              <div className={styles.packPhoto}>
                <img
                  src="/assets/vtc/driver-suit-900.webp"
                  alt="Chauffeur en costume au volant, prêt à prendre une course."
                  width={900}
                  height={1350}
                  loading="lazy"
                />
                <span className={styles.packTag}>Tout compris</span>
              </div>

              <h3 className={styles.packName}>Pack VTC clé en main</h3>
              <p className={styles.packPrice}>
                39 €<span>/ mois</span>
              </p>
              <p className={styles.packNote}>490 € de mise en service, une seule fois · TTC · 12 mois</p>

              <ul className={styles.packList}>
                <li>Nom de domaine .fr offert 1 an</li>
                <li>Site 5 pages avec réservation</li>
                <li>Flyer A5 + carte de visite</li>
                <li>Hébergement et maintenance</li>
              </ul>

              <Link className={styles.packCta} href="/contact?projet=site-vtc">
                Réserver mon créneau
                <span aria-hidden="true">→</span>
              </Link>
              <p className={styles.fineprint}>
                Devis et rendez-vous de cadrage avant production. Mise en ligne en 3 semaines
                ouvrées.
              </p>
            </aside>
          </div>

          <div className={`wrap ${styles.mathBand}`}>
            <p className={styles.mathKick}>Le calcul est simple</p>
            <div>
              <b>30 €</b>
              <span>une course facturée</span>
              <p>Le prix que voit le client.</p>
            </div>
            <div>
              <b>25 %</b>
              <span>de commission plateforme</span>
              <p>7,50 € qui partent à chaque course.</p>
            </div>
            <div>
              <b>2</b>
              <span>courses directes à 30 €</span>
              <p>suffisent à couvrir l’abonnement.</p>
            </div>
            <div>
              <b>0 €</b>
              <span>de commission sur ton site</span>
              <p>Le client réserve, tu encaisses tout.</p>
            </div>
          </div>
        </section>

        {/* 8. FAQ */}
        <section className={styles.lightSection} id="faq">
          <div className="wrap">
            <div className="sec-head">
              <div className="sec-num">Questions</div>
              <div>
                <h2>Ce qu’on nous demande le plus</h2>
                <p>Inscription, seuils, révisions, commande, site et supports : les réponses sans détour.</p>
              </div>
            </div>

            <h3 className={styles.subHead}>L’examen VTC</h3>
            <div className={styles.faq}>
              {faqExamen.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>

            <h3 className={styles.subHead}>Le site et les supports</h3>
            <div className={styles.faq}>
              {faqSite.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 9. CTA final */}
        <section className={styles.ctaSection}>
          <div className="wrap">
            <div className={styles.ctaBand}>
              <p className={styles.ctaKick}>Réviser d’abord. Rouler ensuite.</p>
              <p className={styles.ctaLine}>
                Commence par les fiches gratuites. Prends le guide quand tu veux la méthode.
                Et quand la carte est en poche, on s’occupe du reste.
              </p>
              <div className={styles.ctaLinks}>
                <a className={styles.btnSolid} href={MEMO_URL} target="_blank" rel="noopener">
                  Le PDF gratuit
                  <span aria-hidden="true">↘</span>
                </a>
                <a className={styles.btnGhost} href={GUIDE_URL} target="_blank" rel="noopener">
                  Le guide · 19,90 €
                </a>
              </div>
              <Link className={styles.ctaSite} href="#site">
                Le pack clé en main · 39 €/mois
              </Link>
            </div>

            <p className={styles.legalNote}>
              sujee design n’est ni un organisme de formation agréé, ni un centre d’examen, ni une
              administration. Le guide est un support de révision indépendant : il ne délivre aucun
              titre. Les informations administratives renvoient aux pages officielles de la CMA et de
              service-public.fr. La prestation site et supports est un service distinct, précédé d’un
              devis. Photos : Pexels.
            </p>
          </div>
        </section>
      </main>

      {/* Barre d'action mobile */}
      <div className={styles.stickySpacer} aria-hidden="true" />
      <VtcStickyBar memoUrl={MEMO_URL} guideUrl={GUIDE_URL} />
    </PageShell>
  );
}
