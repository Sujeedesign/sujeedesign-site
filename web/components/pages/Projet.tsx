/** Portage du v5 : projet.html. Balisage d'origine, liens en urls propres. */
export const pageMeta = {
  "title": "Vaasam — Identité et packaging · Sujee Design",
  "description": "Étude de cas : refonte de l'identité et du packaging de Vaasam, épicerie fine parisienne. Système typographique, quarante références, guide d'usage."
};

export function Projet() {
  return (
    <>
<div>
        <header className="proj-head">
          <div className="wrap">
            <p className="kick"><span>Projet 01</span><span>Identité · Packaging</span><span>Paris</span></p>
            <h1>Vaasam</h1>
            <p className="sub">Une épicerie fine qui vend des produits d'ailleurs sans folklore. Le travail tenait en une phrase : faire entrer quarante références dans une seule famille visuelle.</p>
            <dl className="meta-grid">
              <div><dt>Client</dt><dd>Vaasam Paris</dd></div>
              <div><dt>Année</dt><dd>2026</dd></div>
              <div><dt>Périmètre</dt><dd>Nom, logotype, système typographique, packaging, guide</dd></div>
              <div><dt>Durée</dt><dd>6 semaines</dd></div>
            </dl>
            <div className="pj-gallery">
              <figure className="pj-fig">
                <img src="/assets/img/projet/vaasam-pack.jpg" alt="Les trois packagings Vaasam : cumin, curry et safran" width={1440} height={1740} loading="eager" decoding="async" />
              </figure>
              <figure className="pj-fig">
                <img src="/assets/img/projet/vaasam-logo2.jpg" alt="Logotype Vaasam, version principale" width={2952} height={1424} loading="lazy" decoding="async" />
              </figure>
              <figure className="pj-fig">
                <img src="/assets/img/projet/vaasam-gamme2.jpg" alt="Grille des quarante étiquettes" width={1470} height={664} loading="lazy" decoding="async" />
              </figure>
              <figure className="pj-fig">
                <img src="/assets/img/projet/vaasam-spec2.jpg" alt="Spécimen typographique Vaasam" width={1470} height={664} loading="lazy" decoding="async" />
              </figure>
            </div>
          </div>
        </header>
        <section className="section">
          <div className="wrap">
            <div className="chapter rv">
              <div className="k"><b>01</b>Contexte</div>
              <div>
                <h2>Le problème n'était pas le logo</h2>
                <p>Vaasam existait depuis deux ans avec un nom solide et une identité empruntée à un modèle de packaging asiatique générique. En rayon, la marque ne se distinguait pas de trois concurrents. En ligne, elle vendait des produits mais racontait une histoire floue.</p>
                <p>La commande initiale était un nouveau logo. L'audit a montré que le vrai sujet était ailleurs : quarante références, chacune avec son visuel, aucune règle commune. Le logo seul n'aurait rien réglé.</p>
              </div>
            </div>
            <div className="chapter rv">
              <div className="k"><b>02</b>Décision</div>
              <div>
                <h2>Une famille, pas une collection</h2>
                <p>Nous avons construit un système qui tient sur une page : une grille de trois zones, deux familles de caractères, quatre couleurs de fond et un jeu de pictogrammes. Chaque produit hérite de la même structure, seuls le nom et l'origine changent.</p>
                <ul>
                  <li>Logotype en bas de casse, avec un V dessiné qui sert de motif</li>
                  <li>Deux caractères : un grotesque pour les noms, un mono pour les origines et les poids</li>
                  <li>Quatre fonds mats, imprimés en deux tons, pour une série courte</li>
                  <li>Un guide de 24 pages, utilisable par l'imprimeur sans moi</li>
                </ul>
              </div>
            </div>
            <div className="chapter rv">
              <div className="k"><b>03</b>Résultat</div>
              <div>
                <h2>Ce que ça change en rayon</h2>
                <p>La gamme se lit maintenant d'un seul coup d'œil : une colonne de noms, une colonne d'origines, une couleur par famille de produit. L'imprimeur a produit les quarante références sans aller-retour supplémentaire, ce qui n'était jamais arrivé.</p>
                <div className="results">
                  <div><b>40</b><span>références unifiées</span></div>
                  <div><b>2</b><span>tons d'impression</span></div>
                  <div><b>0</b><span>aller-retour imprimeur</span></div>
                </div>
              </div>
            </div>
            <a className="next" href="/realisations">
              <span className="lbl">Projet suivant</span>
              <b>RFA — Marque &amp; franchise</b>
              <span className="lbl">↗</span>
            </a>
          </div>
        </section>
        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p>Un projet, une formation, un avis ?</p>
              <a className="btn-fill btn-fill--light" href="mailto:s.sujeepan.pro@gmail.com?subject=Un%20projet">Prendre contact <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>
      </div>

    </>
  );
}
