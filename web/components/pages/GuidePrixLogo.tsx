import Link from "next/link";
import Faq from "@/components/Faq";
import { routes, serviceHref } from "@/lib/routes";
import styles from "./GuidePrixLogo.module.css";
import { CoverFigure } from "./CoverFigure";

export const pageMeta = {
  title: "Combien coûte un logo en 2026 ? Prix et tarifs",
  description:
    "Prix d'un logo en 2026 : les fourchettes réelles de 40 à 6 000 €, ce que change chaque palier, et la différence avec une identité visuelle complète.",
};

/**
 * Réponse courte servie en haut de page (bloc « En bref ») et première entrée
 * du `FAQPage`. Les chiffres sont ceux des tableaux de la page : ne jamais en
 * introduire un nouveau ici sans le faire apparaître plus bas.
 */
export const aeo = {
  question: "Combien coûte un logo en 2026 ?",
  answer:
    "Sur le marché français, un logo se paie entre 40 et 6 000 € selon ce qui est réellement livré. Un dessin acheté sur une place de marché reste sous 200 €, un logo d'indépendant se situe entre 300 et 800 €. Un logo dessiné, décliné et remis avec ses sources et une cession de droits tourne autour de 1 100 € en moyenne, et un travail de positionnement avec direction artistique autour de 2 000 €. Une identité complète se situe autour de 4 000 € chez un studio. Ici, un logo démarre à 800 € et l'identité complète coûte 2 200 €. Le repère le plus fiable reste le temps de conception : dix à vingt heures pour un logo, trente à cinquante-deux heures pour une identité.",
};

export const faqItems = [
  {
    question: "Pourquoi un logo coûte-t-il plus cher qu'un dessin ?",
    answer:
      "Parce que le dessin n'est que la partie visible. Le prix couvre le cadrage, la recherche, les pistes écartées, les ajustements, les déclinaisons techniques, la préparation des fichiers et la cession des droits.",
  },
  {
    question: "Un logo à 200 € peut-il suffire ?",
    answer:
      "Pour une activité en test, un projet personnel ou un nom qui va changer, oui. Pour une marque que vous comptez garder, le risque est de repayer la mise aux normes et les supports refaits dans les dix-huit mois.",
  },
  {
    question: "Combien de temps prend la création d'un logo ?",
    answer:
      "Dix à vingt heures de travail pour un logo simple, trente à cinquante-deux heures pour une identité complète. Le délai calendaire dépend ensuite des allers-retours et de la date de vos retours.",
  },
  {
    question: "Les fichiers sources sont-ils inclus ?",
    answer:
      "Oui, les fichiers vectoriels et les exports nécessaires. Les fichiers de travail sont remis après paiement intégral, avec une cession de droits écrite.",
  },
  {
    question: "Faut-il déposer la marque ?",
    answer:
      "Le dépôt à l'INPI est une démarche distincte, à faire après la validation du nom et du logo. Une recherche d'antériorité sérieuse évite de payer un dépôt pour un signe déjà pris.",
  },
  {
    question: "Peut-on commencer par un logo et compléter plus tard ?",
    answer:
      "Oui. Sachez simplement qu'un niveau supérieur reprend le travail du précédent, donc compléter plus tard revient souvent plus cher que monter d'un niveau tout de suite.",
  },
  {
    question: "Un logo et une identité visuelle, est-ce le même prix ?",
    answer:
      "Non. Un logo règle la question du signe, une identité visuelle ajoute les couleurs, les typographies secondaires, les déclinaisons et le guide d'usage. Ici, le logo seul démarre à 800 € et l'identité complète se situe à 2 200 €, contre 3 500 € et plus chez un studio pour une identité de même périmètre.",
  },
];

const SOMMAIRE = [
  { href: "#paliers", label: "Les quatre paliers" },
  { href: "#prix", label: "Ce qui fait monter le prix" },
  { href: "#temps", label: "Le temps de travail" },
  { href: "#devis-200", label: "Ce qui manque à 200 €" },
  { href: "#refait", label: "Le coût d'un logo refait" },
  { href: "#marche", label: "Les prix du marché" },
  { href: "#fourchettes", label: "Nos prix" },
  { href: "#identite", label: "Logo ou identité visuelle" },
  { href: "#faq", label: "Questions" },
];

const PALIERS = [
  {
    fourchette: "40 à 200 €",
    produit:
      "Un dessin livré vite, sur une place de marché, un concours ou un générateur. Parfois joli, souvent suffisant pour tester une idée.",
    manque:
      "Les sources vectorielles, les déclinaisons, la vérification d'antériorité, la cession écrite.",
  },
  {
    fourchette: "300 à 800 €",
    produit:
      "Le travail d'un indépendant qui démarre : une ou deux pistes, un fichier propre, quelques retours.",
    manque:
      "La recherche et la veille concurrentielle, les déclinaisons complètes, un cadre écrit.",
  },
  {
    fourchette: "800 à 2 500 €",
    produit:
      "Un brief, une recherche, deux ou trois pistes argumentées, des ajustements suivis, les déclinaisons et les fichiers nommés. C'est le segment des indépendants confirmés et des petits studios, et celui où se situe la plus grande partie des projets de TPE.",
    manque:
      "Rien d'essentiel. C'est le socle d'un logo qui tient dix ans et qui passe partout. Au-dessus de 1 500 €, on paie en plus un travail de positionnement ou de direction artistique.",
  },
  {
    fourchette: "3 500 € et plus",
    produit:
      "Une identité, pas seulement un logo : typographies, palette, règles d'usage, supports déclinés, parfois un travail de positionnement complet. Chez un studio affichant ses prix, l'identité démarre vers 3 500 €, et une refonte de marque se situe entre 3 000 et 15 000 €.",
    manque:
      "Rien, mais ce n'est plus le même projet : on ne dessine pas un signe, on construit un système.",
  },
];

const FACTEURS = [
  {
    titre: "Le cadrage",
    texte:
      "Un entretien, un brief écrit, la clarification de ce que vous êtes et de ce que vous n'êtes pas. Sans ça, le dessin part d'une intuition.",
  },
  {
    titre: "La recherche",
    texte:
      "Concurrence directe, codes du secteur, signes déjà utilisés, tests de lisibilité. C'est la partie que le client ne voit pas et qui évite les mauvaises surprises.",
  },
  {
    titre: "Le nombre de pistes",
    texte:
      "Une piste, c'est un chemin complet avec ses déclinaisons, pas un croquis. Deux ou trois pistes, c'est deux ou trois fois le travail de finition.",
  },
  {
    titre: "Les retours",
    texte:
      "Chaque série de retours est un cycle : reprise, tests, nouvelle version. Un projet à cinq allers-retours ne coûte pas le prix d'un projet à un seul.",
  },
  {
    titre: "Les déclinaisons",
    texte:
      "Version horizontale, verticale, icône, favicon, une couleur, fond sombre, petites tailles. Chacune se vérifie, aucune ne s'improvise.",
  },
  {
    titre: "Les fichiers et les droits",
    texte:
      "Sources propres, nommage, exports, cession écrite, vérification d'antériorité. C'est ce qui rend le logo utilisable par un imprimeur ou un développeur.",
  },
];

const TEMPS = [
  { etape: "Cadrage et brief", logo: "1 à 2 h", identite: "3 à 4 h" },
  { etape: "Recherche et veille", logo: "2 à 4 h", identite: "4 à 6 h" },
  { etape: "Pistes et présentations", logo: "3 à 6 h", identite: "9 à 11 h" },
  { etape: "Ajustements", logo: "2 à 4 h", identite: "6 à 8 h" },
  { etape: "Déclinaisons", logo: "2 à 3 h", identite: "6 à 8 h" },
  { etape: "Fichiers et livraison", logo: "0,5 à 1 h", identite: "2 à 4 h" },
];

const MANQUES = [
  {
    titre: "Pas de brief écrit",
    texte:
      "Le dessin part d'une intuition, pas d'un positionnement. Le résultat peut plaire et ne rien dire de votre différence.",
  },
  {
    titre: "Pas de vérification d'antériorité",
    texte:
      "Rien ne garantit que le signe est libre. Le risque juridique reste chez vous, au moment du dépôt ou plus tard.",
  },
  {
    titre: "Pas de sources vectorielles",
    texte:
      "Un fichier plat ne se redimensionne pas. Chaque nouveau support devient une commande, souvent au prix du logo.",
  },
  {
    titre: "Pas de déclinaisons",
    texte:
      "Le logo casse en favicon, en une seule couleur, sur un fond sombre ou sur un petit format imprimé.",
  },
  {
    titre: "Pas de cession écrite",
    texte:
      "Le droit d'utiliser le logo n'est pas formalisé. C'est le point qui bloque lors d'une revente ou d'un contrôle.",
  },
];

const FOURCHETTES = [
  { offre: "Logo, 3 pistes", range: "800 €", contenu: "Brief, trois pistes, deux séries de retouches, fichiers sources" },
  { offre: "Logo + déclinaisons", range: "1 100 €", contenu: "Déclinaisons horizontale, verticale, icône, favicon, fond sombre" },
  { offre: "Charte graphique", range: "1 200 €", contenu: "Palette, typographies, règles d'usage, guide PDF" },
  { offre: "Pack Lancement", range: "1 200 €", contenu: "Logo, mini-charte et carte de visite" },
  { offre: "Pack Identité Essentiel", range: "1 900 €", contenu: "Logo décliné, charte et deux supports au choix" },
  {
    offre: "Identité visuelle complète",
    range: "2 200 €",
    contenu: "Logo, charte et déclinaisons principales sur les supports courants",
  },
  {
    offre: "Pack Identité Complet",
    range: "3 200 €",
    contenu: "Charte étendue, quatre supports, déclinaisons réseaux",
  },
  {
    offre: "Rebranding",
    range: "3 500 €",
    contenu: "Audit, repositionnement, refonte du logo et de la charte",
  },
];

/**
 * Ordres de grandeur moyens du marché, novembre 2026. Moyennes arrondies des
 * fourchettes publiques par segment, sans citer de concurrent : la page donne un
 * repère de prix, pas un palmarès de tarifs.
 */
const MARCHES = [
  {
    prestation: "Logo, recherche et déclinaisons",
    moyen: "1 100 €",
    repere: "la plupart des projets entre 800 et 1 500 €",
  },
  {
    prestation: "Logo avec positionnement et direction artistique",
    moyen: "2 000 €",
    repere: "entre 1 500 et 2 500 €",
  },
  {
    prestation: "Charte graphique seule",
    moyen: "900 €",
    repere: "de 400 à 1 500 € selon la densité du guide",
  },
  {
    prestation: "Identité visuelle complète",
    moyen: "4 000 €",
    repere: "de 3 500 à 6 000 € chez un studio, bien plus en agence",
  },
  {
    prestation: "Journée de designer (TJM)",
    moyen: "400 €",
    repere: "de 340 à 460 € pour un profil confirmé",
  },
];

export function GuidePrixLogo() {
  return (
    <>
      <header className="page">
        <div className="wrap">
          <div className="page-head">
            <p className="kick">Ressources</p>
            <h1 className={styles.titre}>
              Combien coûte
              <br />
              un <span className={styles.accent}>logo</span> ?
            </h1>
            <p className="intro">
              Un logo se vend entre 40 € et 6 000 €. Ce n&apos;est pas le même produit, ni le
              même travail, ni le même usage. Voici les paliers observés sur le marché français
              en novembre 2026, ce qu&apos;on y trouve, ce qui manque en bas de l&apos;échelle,
              et les prix pratiqués ici.
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
                  slug="creer-un-logo"
                  alt="Graphiste dessinant un logo sur une tablette, devant un écran de création vectorielle."
                  caption="Un logo se dessine et se teste avant d'être livré. C'est ce temps de recherche qui explique l'écart entre un devis à 200 € et un devis à 1 500 €."
                />
                <h2 id="paliers">Les quatre paliers</h2>
                <p>
                  Le prix d&apos;un logo ne monte pas par goût du luxe, il monte parce que le
                  travail change de nature. À chaque palier, on n&apos;achète pas la même chose.
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
                  Six postes expliquent l&apos;écart entre un logo à 150 € et un logo à 1 500 €.
                  Aucun n&apos;est décoratif : chacun correspond à des heures réelles.
                </p>
                {FACTEURS.map((facteur) => (
                  <p key={facteur.titre}>
                    <strong>{facteur.titre}.</strong> {facteur.texte}
                  </p>
                ))}

                <h2 id="temps">Le temps, seule unité comparable</h2>
                <p>
                  Un logo ne se facture pas au dessin mais au temps de conception. Voici les
                  ordres de grandeur sur nos projets, hors échanges clients.
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
                          Logo seul
                        </th>
                        <th scope="col" className={styles.price}>
                          Identité complète
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {TEMPS.map((ligne) => (
                        <tr key={ligne.etape}>
                          <th scope="row">{ligne.etape}</th>
                          <td data-label="Logo seul" className={styles.price}>{ligne.logo}</td>
                          <td data-label="Identité complète" className={styles.price}>{ligne.identite}</td>
                        </tr>
                      ))}
                      <tr>
                        <th scope="row">Total</th>
                        <td data-label="Logo seul" className={styles.price}>10 à 20 h</td>
                        <td data-label="Identité complète" className={styles.price}>30 à 52 h</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className={styles.note}>
                  À 62,50 € de l&apos;heure, soit 500 € la journée, dix à vingt heures donnent
                  625 à 1 250 €, et trente à cinquante-deux heures donnent 1 875 à 3 250 €. Les
                  prix affichés plus bas tombent dans ces ordres de grandeur : un logo à 800 €
                  correspond à environ treize heures de travail, une identité à 2 200 € à
                  trente-cinq heures.
                </p>

                <h2 id="devis-200">Ce qui manque dans un devis à 200 €</h2>
                <p>
                  Un logo à 200 € existe, et il rend service à une activité qui teste une idée.
                  Il faut juste savoir ce qu&apos;on achète. Cinq éléments disparaissent presque
                  toujours à ce prix.
                </p>
                <ul>
                  {MANQUES.map((item) => (
                    <li key={item.titre}>
                      <strong>{item.titre}.</strong> {item.texte}
                    </li>
                  ))}
                </ul>

                <h2 id="refait">Ce que coûte un logo refait</h2>
                <p>
                  Un logo qui casse oblige à refaire les supports : cartes de visite, enseigne,
                  véhicule, signature e-mail, en-tête de devis. Trois supports refaits dépassent
                  souvent l&apos;écart de prix entre le palier bas et le palier structuré. Le
                  calcul utile n&apos;est donc pas « combien ça coûte », mais « combien de temps
                  je garde cette marque ».
                </p>

                <h2 id="marche">Les prix moyens du marché</h2>
                <p>
                  Avant nos tarifs, un repère simple : ce que coûte en moyenne chaque prestation
                  sur le marché français, en novembre 2026, hors taxes. Ce sont des moyennes
                  arrondies, tous prestataires confondus, pas des prix de concurrents en
                  particulier.
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
                  Deux constats. Un logo avec recherche, déclinaisons et cession de droits tourne
                  autour de 1 100 € : sous 500 €, il n&apos;y a pas de recherche, seulement de
                  l&apos;exécution. Et l&apos;écart entre un indépendant et un studio ne se joue
                  pas sur le dessin mais sur ce qui l&apos;entoure : positionnement, direction
                  artistique, nombre de supports. C&apos;est exactement la frontière entre nos
                  offres.
                </p>

                <h2 id="fourchettes">Nos prix</h2>
                <p>
                  Voici les tarifs du studio, hors taxes, en novembre 2026. Ce sont des prix de
                  départ : le devis les précise selon le périmètre, et chaque niveau reprend le
                  travail du précédent.
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
                      {FOURCHETTES.map((ligne) => (
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
                  Ces prix situent le budget. Le devis se construit ensuite sur votre périmètre :
                  nombre de déclinaisons, supports, délais et contenus fournis. Les options
                  courantes (carte de visite, flyer, affiche, plaquette, post) sont chiffrées
                  séparément dans le{" "}
                  <Link href={routes.calculateurBudgetIdentite}>calculateur de budget</Link>.
                </p>

                <h2 id="identite">Prix d&apos;un logo ou prix d&apos;une identité visuelle</h2>
                <p>
                  Un logo seul répond à une question de signe : le nom, la typographie, la
                  marque. Une identité visuelle ajoute ce qui fait tenir ce signe dans le temps,
                  les couleurs, les typographies secondaires, les règles d&apos;usage et les
                  déclinaisons sur vos supports. Les deux prix ne se comparent donc pas, ils ne
                  paient pas le même travail.
                </p>
                <p>
                  Ici, le logo seul démarre à 800 € et l&apos;identité visuelle complète coûte
                  2 200 €, là où un studio affichant ses prix démarre autour de 3 500 €.
                  L&apos;écart ne paie pas un dessin plus beau : il paie les déclinaisons et le
                  guide d&apos;usage qui évitent de refaire carte, enseigne et signature dans les
                  dix-huit mois.
                </p>
                <p>
                  Pour situer votre cas, le{" "}
                  <Link href={routes.calculateurBudgetIdentite}>calculateur de budget identité</Link>{" "}
                  donne une fourchette en trois minutes, et la page{" "}
                  <Link href={serviceHref("identite-de-marque")}>identité de marque</Link> détaille
                  ce qui est livré, sources et accès à votre nom compris. Si vous partez d&apos;un
                  brief encore flou, le{" "}
                  <Link href={routes.generateurBriefIdentite}>générateur de brief</Link> le met en
                  forme avant le premier rendez-vous.
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
              <p>Un chiffre, puis un devis.</p>
              <p className={styles.ctaText}>
                Trois minutes pour situer votre budget, sans engagement et sans laisser d&apos;email.
              </p>
            </div>
            <div className={styles.ctaLinks}>
              <Link className="btn-fill btn-fill--light" href={routes.calculateurBudgetIdentite}>
                Estimer mon budget <span aria-hidden="true">↗</span>
              </Link>
              <Link className="btn-line btn-line--light" href={serviceHref("identite-de-marque")}>
                Voir l&apos;offre identité de marque
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
