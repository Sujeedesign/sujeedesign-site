/** Portage du v5 : services.html. Balisage d'origine, liens en urls propres. */
export const pageMeta = {
  "title": "Services — identité, web, contenu et IA",
  "description": "Identité de marque, direction artistique, sites WordPress et Shopify, contenu, agents IA. Périmètre écrit, livraison documentée, sources à votre nom."
};

export function Services() {
  return (
    <>
<div>
        <header className="sv-hero">
          <div className="wrap">
            <p className="kick ia-kick"><span className="live-dot" aria-hidden="true" />Services · Périmètre écrit</p>
            <div className="sv-hero__grid">
              <div>
                <h1 className="sv-hero__title">Cinq métiers,<br /><span className="hl">un seul interlocuteur.</span></h1>
                <p className="sv-hero__lead">Le périmètre est écrit avant de commencer. Les allers-retours sont inclus, et vous repartez avec les sources et les accès à votre nom.</p>
                <p className="sunburst__label">Les cinq métiers</p>
                <div className="sunburst" aria-hidden="true">
                  <div className="sunburst__item"><b>01</b><span>Identité</span></div>
                  <div className="sunburst__item"><b>02</b><span>Direction artistique</span></div>
                  <div className="sunburst__item"><b>03</b><span>Site &amp; e-commerce</span></div>
                  <div className="sunburst__item"><b>04</b><span>Contenu</span></div>
                  <div className="sunburst__item"><b>05</b><span>Agents IA</span></div>
                </div>
              </div>
              <div className="sv-hero__fig">
                <svg viewBox="0 0 400 400" role="img" aria-label="Schéma radial des cinq métiers autour d'un seul interlocuteur">
                  <circle className="ring" cx={200} cy={200} r={118} />
                  <circle className="ring ring--in" cx={200} cy={200} r={82} />
                  <circle className="ring ring--dash" cx={200} cy={200} r={140} />
                  <g className="spokes">
                    <path d="M200 82V58" /><path d="M312.3 163.6l22.8-7.4" /><path d="M269.3 304.3l14.1 19.4" />
                    <path d="M130.7 304.3l-14.1 19.4" /><path d="M87.7 163.6l-22.8-7.4" />
                  </g>
                  <g className="dots">
                    <circle cx={200} cy={48} r={9} /><circle cx="344.6" cy={153} r={9} />
                    <circle cx="289.3" cy={323} r={9} /><circle cx="110.7" cy={323} r={9} />
                    <circle cx="55.4" cy={153} r={9} />
                  </g>
                  <g className="dot-nums">
                    <text x={200} y={51}>01</text><text x="344.6" y={156}>02</text>
                    <text x="289.3" y={326}>03</text><text x="110.7" y={326}>04</text>
                    <text x="55.4" y={156}>05</text>
                  </g>
                  <g className="fig-labels">
                    <text x={200} y={26}>IDENTITÉ</text><text x={368} y={144}>DIR. ART</text>
                    <text x={303} y={352}>SITE</text><text x={97} y={352}>CONTENU</text>
                    <text x={34} y={144}>IA</text>
                  </g>
                  <circle className="core-halo" cx={200} cy={200} r={46} />
                  <image className="core-mark" href="/assets/logo-sujee-icon.svg" x={182} y={161} width={36} height={78} />
                </svg>
              </div>
            </div>
            <div className="sv-hero__meta">
              <div><span>Périmètre</span><p>Écrit avant le premier trait, validé par vous, pas de rallonge surprise.</p></div>
              <div><span>Livrables</span><p>Sources, accès à votre nom, documentation et prise en main.</p></div>
              <div><span>Durée</span><p>D'une semaine pour un audit à six semaines pour un site complet.</p></div>
            </div>
          </div>
        </header>
        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">01</div>
              <div>
                <h2>Cinq façons<br />de travailler ensemble.</h2>
                <p>Un seul interlocuteur du cadrage à la livraison. Chaque métier peut se prendre seul ou s'enchaîner, avec un périmètre écrit à chaque fois.</p>
              </div>
              <div className="side">Prestations</div>
            </div>
            <div className="sv-rows">
              <a className="sv-row rv" href="/services/identite-de-marque">
                <div className="sv-row__body">
                  <div className="sv-row__top"><span className="sv-row__n">01</span><span className="sv-row__dur">3 à 5 semaines</span></div>
                  <h3>Identité de marque</h3>
                  <p>Nom, logotype, système typographique, couleurs, guide d'usage. Un système qui tient sur un menu, une carte de visite et une devanture.</p>
                  <ul className="sv-tags"><li>Nom</li><li>Logotype</li><li>Typographie</li><li>Couleurs</li><li>Guide</li></ul>
                  <span className="sv-row__more">Voir le détail <span aria-hidden="true">↗</span></span>
                </div>
                <div className="sv-row__media">
                  <img src="/assets/img/svc-identite.jpg" alt="Papeterie de marque : cartes, monogramme embossé et nuancier, sur fond papier." width={1400} height={933} loading="lazy" decoding="async" />
                </div>
              </a>
              <a className="sv-row rv" href="/services/direction-artistique">
                <div className="sv-row__body">
                  <div className="sv-row__top"><span className="sv-row__n">02</span><span className="sv-row__dur">1 à 3 semaines</span></div>
                  <h3>Direction artistique</h3>
                  <p>Print, éditions, campagnes, photographie. Je tiens le ton visuel sur la durée, pas seulement sur la première campagne.</p>
                  <ul className="sv-tags"><li>Print</li><li>Photo</li><li>Campagne</li><li>Édition</li></ul>
                  <span className="sv-row__more">Voir le détail <span aria-hidden="true">↗</span></span>
                </div>
                <div className="sv-row__media">
                  <img src="/assets/img/svc-da.jpg" alt="Tirages photo, planches contact et repères de cadrage sur papier." width={1400} height={933} loading="lazy" decoding="async" />
                </div>
              </a>
              <a className="sv-row rv" href="/services/site-ecommerce">
                <div className="sv-row__body">
                  <div className="sv-row__top"><span className="sv-row__n">03</span><span className="sv-row__dur">3 à 6 semaines</span></div>
                  <h3>Site &amp; e-commerce</h3>
                  <p>Design, intégration WordPress ou Shopify, SEO technique, performance, formation. Vous gardez la main sur le contenu.</p>
                  <ul className="sv-tags"><li>UX</li><li>Design</li><li>WordPress</li><li>Shopify</li><li>SEO</li></ul>
                  <span className="sv-row__more">Voir le détail <span aria-hidden="true">↗</span></span>
                </div>
                <div className="sv-row__media">
                  <img src="/assets/img/svc-site.jpg" alt="Maquettes imprimées d'une grille de page web et onglet vermillon." width={1400} height={933} loading="lazy" decoding="async" />
                </div>
              </a>
              <a className="sv-row rv" href="/services/contenu-reseaux">
                <div className="sv-row__body">
                  <div className="sv-row__top"><span className="sv-row__n">04</span><span className="sv-row__dur">En continu</span></div>
                  <h3>Contenu &amp; réseaux</h3>
                  <p>Ligne éditoriale, gabarits réutilisables, production régulière. Le but est que vous puissiez continuer sans moi.</p>
                  <ul className="sv-tags"><li>Ligne édito</li><li>Gabarits</li><li>Photo</li><li>Rédaction</li></ul>
                  <span className="sv-row__more">Voir le détail <span aria-hidden="true">↗</span></span>
                </div>
                <div className="sv-row__media">
                  <img src="/assets/img/svc-contenu.jpg" alt="Revue ouverte, appareil photo et notes adhésives vermillon." width={1400} height={933} loading="lazy" decoding="async" />
                </div>
              </a>
              <a className="sv-row rv" href="/agents-ia">
                <div className="sv-row__body">
                  <div className="sv-row__top"><span className="sv-row__n">05</span><span className="sv-row__dur">1 à 4 semaines</span></div>
                  <h3>Agents IA</h3>
                  <p>Audit des tâches répétitives, automatisations, assistants internes, formation. On mesure le temps gagné, sinon on arrête.</p>
                  <ul className="sv-tags"><li>Audit</li><li>Automatisation</li><li>Agents</li><li>Formation</li></ul>
                  <span className="sv-row__more">Voir la page agents <span aria-hidden="true">↗</span></span>
                </div>
                <div className="sv-row__media">
                  <img src="/assets/img/svc-agents.jpg" alt="Bloc mat anthracite à diode vermillon, câble fin sur papier clair." width={1400} height={933} loading="lazy" decoding="async" />
                </div>
              </a>
            </div>
          </div>
        </section>
        <section className="section section--tint">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">02</div>
              <div>
                <h2>Comment ça<br />se passe.</h2>
                <p>Trois temps, un point de validation à chaque étape. Rien ne part en production sans votre accord écrit.</p>
              </div>
              <div className="side">Méthode</div>
            </div>
            <div className="method rv">
              <div className="method__rail" aria-hidden="true"><span /></div>
              <div className="method__steps method__steps--3">
                <div className="method__step"><b>01</b><span>Cadrer</span><i>Un appel, un audit de l'existant, un périmètre écrit. Si le projet ne tient pas debout, je le dis avant de commencer.</i><em>1 semaine</em></div>
                <div className="method__step"><b>02</b><span>Concevoir</span><i>Deux directions maximum, présentées sur du réel : vos pages, vos supports, vos mots.</i><em>2 à 4 semaines</em></div>
                <div className="method__step"><b>03</b><span>Livrer</span><i>Mise en ligne, sources, accès à votre nom, documentation et prise en main.</i><em>1 à 3 semaines</em></div>
              </div>
            </div>
            <div className="deliver rv">
              <div className="deliver__head">
                <span className="mono">Ce que vous gardez</span>
                <p>Tout ce qui est produit vous appartient. Aucun verrou, aucune dépendance à mon compte.</p>
              </div>
              <div className="deliver__cols">
                <div><b>Sources</b><span>Fichiers de travail, pas seulement les exports.</span></div>
                <div><b>Accès</b><span>Hébergement, domaine et CMS à votre nom.</span></div>
                <div><b>Documentation</b><span>Ce qui est livré, comment le modifier, qui contacter.</span></div>
                <div><b>Prise en main</b><span>Une session pour que vous puissiez continuer seul.</span></div>
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">03</div>
              <div><h2>Les questions<br />qui reviennent.</h2><p>Les quatre qui arrivent à chaque premier appel.</p></div>
              <div className="side">FAQ</div>
            </div>
            <div className="faq rv">
              <details><summary>Comment démarre un projet ?</summary><p>Par un appel de trente minutes : ce que vous vendez, ce qui coince, ce que vous voulez obtenir. J'envoie ensuite un périmètre écrit, et le projet démarre quand il est validé.</p></details>
              <details><summary>Combien de temps pour un site complet ?</summary><p>Trois à six semaines pour un site vitrine de cinq à dix pages, hors production de contenu. Le délai dépend surtout de la vitesse à laquelle les textes et les visuels arrivent.</p></details>
              <details><summary>Qui fait les textes ?</summary><p>Vous, ou moi en option. Dans les deux cas, je fournis la structure et les niveaux de titre : c'est ce qui fait la différence entre une page qui convertit et une page qui décrit.</p></details>
              <details><summary>Et après la livraison ?</summary><p>Vous partez avec les sources, les accès et une documentation. Une maintenance est possible, jamais obligatoire. Je réponds sous 48 h ouvrées, même après la fin du projet.</p></details>
            </div>
          </div>
        </section>
        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p>Vous ne savez pas par quel bout commencer ?</p>
              <a className="btn-fill btn-fill--light" href="mailto:s.sujeepan.pro@gmail.com?subject=Un%20projet">Décrire mon besoin <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>
      </div>

    </>
  );
}
