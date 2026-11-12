import type { Metadata } from "next";
import Link from "next/link";
import s from "./vtc.module.css";

const SITE_URL = "https://sujeedesign.com";
const GUIDE_URL = "https://sujeedesign.gumroad.com/l/reussir-examen-vtc-2026";
const MEMO_URL = "https://sujeedesign.gumroad.com/l/fiches-memo-examen-vtc-2026";

export const metadata: Metadata = {
  title: {
    absolute: "Réussir l'examen VTC 2026 en candidat libre | Le guide complet",
  },
  description:
    "Sept épreuves écrites, une épreuve pratique : le guide complet de l'examen VTC 2026, écrit pour les candidats libres. 85 pages, 14 chapitres, un plan de révision de 45 jours et 7 fiches mémo gratuites.",
  alternates: { canonical: "/reussir-examen-vtc" },
  openGraph: {
    type: "article",
    title: "Réussir l'examen VTC 2026 en candidat libre",
    description:
      "Le guide complet des épreuves VTC pour ceux qui préparent seuls. 85 pages, 14 chapitres, plan de 45 jours, fiches mémo gratuites.",
    url: `${SITE_URL}/reussir-examen-vtc`,
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
    q: "Combien de temps faut-il pour réviser ?",
    a: "Le guide propose un plan de 45 jours à raison d'une heure trente par jour, et une version accélérée en 14 jours pour ceux qui passent dans trois semaines. En dessous de deux semaines, il faut viser les épreuves à fort coefficient et accepter de repasser les autres.",
  },
  {
    q: "Combien d'épreuves y a-t-il et combien de temps dure l'examen ?",
    a: "Sept épreuves écrites, pour 3 h 50 au total et un coefficient cumulé de 17, puis une épreuve pratique d'admission. Chaque épreuve écrite demande 6 sur 20 minimum, sauf l'anglais qui tolère 4 sur 20, et la moyenne pondérée doit atteindre 10 sur 20.",
  },
  {
    q: "Le guide est-il à jour de la réglementation 2026 ?",
    a: "Oui. Les textes ont été arrêtés au 11 novembre 2026 : arrêté du 6 avril 2017 modifié, décret du 27 juin 2026 sur les sanctions de l'exercice illégal et réforme du 12 août 2026. Les montants et les durées cités sont ceux en vigueur à cette date.",
  },
  {
    q: "Le guide remplace-t-il une formation ou un centre agréé ?",
    a: "Non, et il ne le prétend pas. C'est un ouvrage indépendant, sans lien avec un organisme agréé, un centre de formation ou une administration. Il sert à préparer les épreuves et à comprendre ce qui est noté, pas à délivrer un titre.",
  },
  {
    q: "Comment se passe l'achat et le téléchargement ?",
    a: "Le paiement se fait sur Gumroad, par carte, et le PDF est téléchargeable immédiatement après l'achat. Les 7 fiches mémo sont gratuites et servent à tester le contenu avant d'acheter le guide complet.",
  },
];

export default function Page() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Book",
        name: "Réussir l'examen VTC 2026",
        bookFormat: "https://schema.org/EBook",
        numberOfPages: 85,
        inLanguage: "fr",
        author: { "@type": "Person", name: "Sujeepan Sabesan" },
        description:
          "Le guide complet de l'examen VTC 2026 pour les candidats libres : les sept épreuves écrites, l'épreuve pratique, 54 chiffres, un examen blanc corrigé et un plan de révision de 45 jours.",
        offers: {
          "@type": "Offer",
          price: "19.90",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          url: GUIDE_URL,
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className={s.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className={s.top}>
        <a href="#haut" className={s.brand}>
          Réussir l'examen VTC <span>2026</span>
        </a>
        <a href={GUIDE_URL} className={s.topCta}>
          Le guide, 19,90 €
        </a>
      </header>

      <main id="haut">
        <section className={s.hero}>
          <p className={s.label}>Guide indépendant · Édition novembre 2026</p>
          <h1>
            Passer l'examen VTC en candidat libre. <em>Sans centre de formation.</em>
          </h1>
          <p className={s.lead}>
            Sept épreuves écrites, une épreuve pratique, un seul livre. 85 pages pour savoir ce qui est
            noté, dans quel ordre réviser et où se perdent les points, avec un plan de 45 jours et sept
            fiches mémo à imprimer.
          </p>
          <div className={s.actions}>
            <a href={MEMO_URL} className={s.btn}>
              Les 7 fiches mémo, gratuit
            </a>
            <a href={GUIDE_URL} className={s.btnGhost}>
              Le guide complet, 19,90 €
            </a>
          </div>
          <p className={s.fineprint}>
            PDF téléchargé immédiatement · code <strong>LANCEMENT-VTC</strong> : 13,93 € au lieu de 19,90 €
            jusqu'au 12 décembre 2026
          </p>

          <ul className={s.stats}>
            <li><b>85</b><span>pages</span></li>
            <li><b>14</b><span>chapitres</span></li>
            <li><b>7</b><span>épreuves couvertes</span></li>
            <li><b>45</b><span>jours de plan</span></li>
          </ul>
        </section>

        <section className={s.section}>
          <h2>Ce que l'examen demande vraiment</h2>
          <p className={s.intro}>
            Un candidat libre ne se plante pas par manque de motivation. Il se plante parce qu'il révise
            au hasard, sans savoir que deux épreuves pèsent un tiers de la note et que la pratique peut
            tout annuler. Voici la grille réelle.
          </p>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Épreuve</th>
                  <th>Matière</th>
                  <th>Coef</th>
                  <th>Durée</th>
                  <th>Format</th>
                </tr>
              </thead>
              <tbody>
                {epreuves.map((row) => (
                  <tr key={row.e}>
                    <td className={s.coef}>{row.e}</td>
                    <td>{row.nom}</td>
                    <td className={s.num}>{row.coef}</td>
                    <td className={s.num}>{row.duree}</td>
                    <td className={s.num}>{row.format}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={s.rules}>
            <div>
              <span className={s.ruleNum}>6/20</span>
              <p>Note plancher par épreuve, sauf l'anglais qui tolère 4/20. Une épreuve sous le plancher élimine.</p>
            </div>
            <div>
              <span className={s.ruleNum}>10/20</span>
              <p>Moyenne pondérée exigée sur l'ensemble des écrits. Ce n'est pas la moyenne des notes, c'est celle des coefficients.</p>
            </div>
            <div>
              <span className={s.ruleNum}>12/20</span>
              <p>Note minimale à l'épreuve pratique. C'est l'admission : elle ne se rattrape pas avec de bons écrits.</p>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <h2>Les quatre erreurs qui coûtent l'examen</h2>
          <ol className={s.errors}>
            <li>
              <strong>Traiter les QRC comme des QCM.</strong> Les épreuves A, B, D, F et G contiennent des
              questions à réponse courte, attendues en une phrase construite, pas en trois mots. C'est là
              que se perdent les demi-points qui font passer de 9,5 à 10.
            </li>
            <li>
              <strong>Préparer la pratique en dernier.</strong> Coefficient 3, note plancher 12 sur 20,
              double commande et ajournement immédiat. Deux semaines suffisent pour un script d'accueil
              solide, à condition de s'y prendre avant la dernière semaine.
            </li>
            <li>
              <strong>Apprendre les chiffres en vrac.</strong> 54 chiffres réglementaires tombent en QCM.
              Sans classement par thème, ils se mélangent le jour J. Le guide les range par épreuve et par
              famille de délais.
            </li>
            <li>
              <strong>Caler les révisions sur trois semaines.</strong> C'est possible, mais alors il faut
              choisir les matières à fort coefficient et accepter de repasser le reste. Un plan de 45 jours
              coûte moins cher qu'un deuxième passage à 170 €.
            </li>
          </ol>
        </section>

        <section className={s.section}>
          <h2>La méthode des 45 jours</h2>
          <p className={s.intro}>
            Une heure trente par jour, six semaines, un objectif par semaine. Le plan est écrit dans le
            livre, jour par jour, y compris les jours de repos.
          </p>
          <div className={s.weeks}>
            <div><span>Semaine 1</span><p>Cadrer l'examen, démarrer la gestion et le développement commercial.</p></div>
            <div><span>Semaine 2</span><p>Sécurité routière et réglementation spécifique, les deux matières les plus rentables.</p></div>
            <div><span>Semaine 3</span><p>Français et anglais : rédactions chronométrées, vocabulaire du transport.</p></div>
            <div><span>Semaine 4</span><p>Épreuve pratique : script d'accueil, parcours, questions du jury.</p></div>
            <div><span>Semaine 5</span><p>Textes de loi, les 54 chiffres, un examen blanc complet chronométré.</p></div>
            <div><span>Semaine 6</span><p>Consolidation, questions ratées uniquement, veille et logistique du jour J.</p></div>
          </div>
        </section>

        <section className={s.section}>
          <h2>Ce qu'il y a dans le guide</h2>
          <ul className={s.contents}>
            <li>Les sept épreuves écrites expliquées matière par matière, avec les QRC types et les erreurs classiques.</li>
            <li>L'épreuve pratique de bout en bout : préparation du parcours, accueil en trois minutes, conduite notée, questions du jury.</li>
            <li>54 chiffres réglementaires classés par thème, vérifiés au 11 novembre 2026.</li>
            <li>Un lexique de 60 entrées et les huit textes de loi à connaître, avec ce qu'on te demandera dessus.</li>
            <li>Un examen blanc de 40 QCM et 5 QRC, corrigé et commenté, pour te noter avant le jour J.</li>
            <li>Le plan de révision sur 45 jours et la fiche du jour J : documents, horaires, pièges.</li>
          </ul>
        </section>

        <section className={s.offer}>
          <div className={s.offerCard}>
            <div>
              <p className={s.label}>Le guide complet</p>
              <h2 className={s.offerTitle}>Réussir l'examen VTC 2026</h2>
              <p className={s.offerText}>
                85 pages, 14 chapitres, PDF mis en page pour la lecture à l'écran et l'impression.
                Édition novembre 2026, textes à jour.
              </p>
              <ul className={s.offerList}>
                <li>Les 7 épreuves écrites et la pratique</li>
                <li>54 chiffres, lexique, textes de loi</li>
                <li>Examen blanc corrigé et plan de 45 jours</li>
                <li>Les 7 fiches mémo incluses, en plus du PDF offert</li>
              </ul>
            </div>
            <div className={s.buy}>
              <p className={s.price}>19,90 €</p>
              <p className={s.promo}>
                13,93 € avec le code <strong>LANCEMENT-VTC</strong>
                <br />
                20 exemplaires, jusqu'au 12/12/2026
              </p>
              <a href={GUIDE_URL} className={s.btn}>
                Acheter le guide
              </a>
              <a href={MEMO_URL} className={s.btnGhost}>
                D'abord les fiches gratuites
              </a>
              <p className={s.fineprint}>
                Paiement Gumroad · PDF immédiat · produit numérique, pas de rétractation après téléchargement
              </p>
            </div>
          </div>
        </section>

        <section className={s.section}>
          <h2>Questions fréquentes</h2>
          <div className={s.faq}>
            {faq.map((f) => (
              <details key={f.q} className={s.faqItem}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={s.final}>
          <h2>Tu peux le préparer seul. À condition de savoir ce qui est noté.</h2>
          <p>
            Commence par les fiches mémo, elles sont gratuites. Si le contenu te parle, le guide complet
            prend la suite avec la méthode, les textes et l'entraînement.
          </p>
          <div className={s.actions}>
            <a href={MEMO_URL} className={s.btn}>
              Télécharger les fiches mémo
            </a>
            <a href={GUIDE_URL} className={s.btnGhost}>
              Voir le guide, 19,90 €
            </a>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <p className={s.brandSmall}>Réussir l'examen VTC 2026</p>
        <p>
          Ouvrage indépendant édité par Sujeepan Sabesan. Non affilié à un organisme agréé, à un centre de
          formation, à une administration ou à une plateforme de VTC. Les informations sont données à titre
          pédagogique et ne remplacent pas les textes officiels en vigueur.
        </p>
        <p className={s.legal}>
          <Link href="/mentions-legales">Mentions légales</Link>
          <span>·</span>
          <a href="mailto:contact@sujeedesign.com">contact@sujeedesign.com</a>
        </p>
      </footer>
    </div>
  );
}
