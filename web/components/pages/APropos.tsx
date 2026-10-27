/** Portage du v5 : a-propos.html. Balisage d'origine, liens en urls propres. */
export const pageMeta = {
  "title": "À propos — Sujee Design",
  "description": "Sujeepan Sabesan, designer indépendant entre Cergy et Paris depuis 2013 : direction artistique, photo et vidéo, UX/UI, IA générative, web et formation."
};

export function APropos() {
  return (
    <>
<div>
        {/* HERO */}
        <header className="ab-hero">
          <div className="wrap">
            <p className="kick">À propos · Sujeepan Sabesan</p>
            <div className="ab-hero__grid">
              <h1 className="ab-hero__title">Je dessine,<br />je cadre,<br /><em>j'enseigne.</em></h1>
              <div className="ab-hero__side">
                <p className="ab-sig">Sujeepan Sabesan</p>
                <p className="ab-sig__sub">Designer, photographe, formateur. Je signe ce que je livre.</p>
                <p className="ab-hero__lead">Treize ans de studio entre Cergy et Paris, à faire la même chose sous des formes différentes : donner une allure juste à des marques qui n'ont pas les moyens d'une agence. Identités, sites, images, emballages. Et depuis huit ans, des classes entières à qui je transmets la méthode.</p>
                <p className="ab-hero__lead ab-hero__lead--2">Vous parlez à la personne qui dessine, qui code quand il faut, qui cadre le shooting et qui répond. <b>Un seul interlocuteur, du premier croquis à la mise en ligne.</b></p>
                <div className="ab-stats-hero">
                  <div><b>13</b><span>ans de studio</span></div>
                  <div><b>60+</b><span>marques</span></div>
                  <div><b>8</b><span>ans d'enseignement</span></div>
                  <div><b>6</b><span>écoles</span></div>
                </div>
                <div className="ab-hero__cta">
                  <a className="btn-fill" href="/realisations">Voir les projets <span aria-hidden="true">↗</span></a>
                  <a className="btn-line" href="mailto:s.sujeepan.pro@gmail.com?subject=Un%20projet">Écrire un message</a>
                </div>
              </div>
            </div>
          </div>
          <div className="ab-hero__block">
            <figure className="ab-hero__fig">
              <img src="/assets/sujeepan_sabesan.jpg" alt="Portrait de Sujeepan Sabesan, designer et directeur artistique à Paris" />
              <figcaption>Sujeepan Sabesan · Cergy · Paris</figcaption>
            </figure>
            <aside className="ab-hero__panel">
              <div><span>Basé à</span><p>Cergy et Paris. Je travaille aussi chez les clients, en Île-de-France et à distance.</p></div>
              <div><span>Statut</span><p>Indépendant depuis 2013. Un seul interlocuteur, du brief à la livraison.</p></div>
              <div><span>Disponibilité</span><p>Novembre 2026, deux projets en parallèle maximum.</p></div>
            </aside>
          </div>
        </header>
        {/* COMPÉTENCES */}
        <section className="section" id="savoir-faire">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">01</div>
              <div>
                <h2>Six métiers,<br />une même main.</h2>
                <p>Une identité ne vit pas seule. Elle se juge sur la photo qui l'accompagne, le site qui la porte et l'outil qui la fait tourner. C'est pour ça que je couvre toute la chaîne.</p>
              </div>
              <div className="side">De la direction artistique au code</div>
            </div>
            <div className="rows">
              <article className="row rv">
                <span className="row__n">01</span>
                <h3>Direction artistique</h3>
                <p>Nom, logo, typographie, couleur, principes de mise en page. Je construis des systèmes que vos équipes tiennent sans moi, sur un flyer comme sur une façade de boutique.</p>
                <div className="row__tags"><span>Identité</span><span>Charte</span><span>Édition</span></div>
              </article>
              <article className="row rv">
                <span className="row__n">02</span>
                <h3>Photographie &amp; vidéo</h3>
                <p>Direction de shooting, prise de vue, retouche, montage, motion. L'image est pensée pour son support final, pas produite puis recadrée au hasard.</p>
                <div className="row__tags"><span>Shooting produit</span><span>Portrait</span><span>Montage</span></div>
              </article>
              <article className="row rv">
                <span className="row__n">03</span>
                <h3>UX/UI design</h3>
                <p>Parcours, arborescence, maquettes, design system. Je conçois l'écran en gardant en tête le référencement, la performance et la maintenance.</p>
                <div className="row__tags"><span>Parcours</span><span>Figma</span><span>Design system</span></div>
              </article>
              <article className="row rv">
                <span className="row__n">04</span>
                <h3>IA générative &amp; agents</h3>
                <p>Images et contenus générés dans un cadre de marque, automatisations métier, agents connectés à vos outils. Une pratique quotidienne, pas une démonstration.</p>
                <div className="row__tags"><span>Direction de modèles</span><span>Automatisation</span><span>Agents</span></div>
              </article>
              <article className="row rv">
                <span className="row__n">05</span>
                <h3>Formation &amp; pédagogie</h3>
                <p>Huit ans devant des classes, du BTS au mastère. J'ai appris à expliquer sans jargon, à faire produire vite, et à laisser des supports qui servent encore après le cours.</p>
                <div className="row__tags"><span>Design graphique</span><span>UI/UX</span><span>IA appliquée</span></div>
              </article>
              <article className="row rv">
                <span className="row__n">06</span>
                <h3>Web &amp; intégration</h3>
                <p>Sites vitrines et e-commerce : WordPress, Shopify, Webflow, Framer, HTML/CSS. Livrés rapides, propres, avec une prise en main et une formation à la clé.</p>
                <div className="row__tags"><span>WordPress</span><span>Shopify</span><span>SEO technique</span></div>
              </article>
            </div>
          </div>
        </section>
        {/* OUTILS */}
        <section className="section section--ink">
          <div className="wrap">
            <div className="sec-head sec-head--dark rv">
              <div className="sec-num">02</div>
              <div>
                <h2>Les outils<br />du quotidien.</h2>
                <p>Pas une liste apprise une fois. Les logiciels que j'ouvre chaque semaine, sur des projets livrés.</p>
              </div>
              <div className="side">Design · Image · Web · IA</div>
            </div>
            <div className="toolwall rv">
              <div className="tool"><img src="/assets/tools/figma.svg" alt="" loading="lazy" /><span>Figma</span></div>
              <div className="tool"><img src="/assets/tools/adobephotoshop.svg" alt="" loading="lazy" /><span>Photoshop</span></div>
              <div className="tool"><img src="/assets/tools/adobeillustrator.svg" alt="" loading="lazy" /><span>Illustrator</span></div>
              <div className="tool"><img src="/assets/tools/adobeindesign.svg" alt="" loading="lazy" /><span>InDesign</span></div>
              <div className="tool"><img src="/assets/tools/adobelightroom.svg" alt="" loading="lazy" /><span>Lightroom</span></div>
              <div className="tool"><img src="/assets/tools/adobexd.svg" alt="" loading="lazy" /><span>XD</span></div>
              <div className="tool"><img src="/assets/tools/adobepremierepro.svg" alt="" loading="lazy" /><span>Premiere Pro</span></div>
              <div className="tool"><img src="/assets/tools/adobeaftereffects.svg" alt="" loading="lazy" /><span>After Effects</span></div>
              <div className="tool"><img src="/assets/tools/davinciresolve.svg" alt="" loading="lazy" /><span>DaVinci</span></div>
              <div className="tool"><img src="/assets/tools/wordpress.svg" alt="" loading="lazy" /><span>WordPress</span></div>
              <div className="tool"><img src="/assets/tools/elementor.svg" alt="" loading="lazy" /><span>Elementor</span></div>
              <div className="tool"><img src="/assets/tools/shopify.svg" alt="" loading="lazy" /><span>Shopify</span></div>
              <div className="tool"><img src="/assets/tools/webflow.svg" alt="" loading="lazy" /><span>Webflow</span></div>
              <div className="tool"><img src="/assets/tools/framer.svg" alt="" loading="lazy" /><span>Framer</span></div>
              <div className="tool"><img src="/assets/tools/html5.svg" alt="" loading="lazy" /><span>HTML / CSS</span></div>
              <div className="tool"><img src="/assets/tools/openai.svg" alt="" loading="lazy" /><span>ChatGPT</span></div>
              <div className="tool"><img src="/assets/tools/anthropic.svg" alt="" loading="lazy" /><span>Claude</span></div>
              <div className="tool"><img src="/assets/tools/googlegemini.svg" alt="" loading="lazy" /><span>Gemini</span></div>
              <div className="tool"><img src="/assets/tools/ollama.svg" alt="" loading="lazy" /><span>Ollama</span></div>
              <div className="tool"><img src="/assets/tools/n8n.svg" alt="" loading="lazy" /><span>n8n</span></div>
              <div className="tool"><img src="/assets/tools/make.svg" alt="" loading="lazy" /><span>Make</span></div>
              <div className="tool"><img src="/assets/tools/notion.svg" alt="" loading="lazy" /><span>Notion</span></div>
              <div className="tool"><img src="/assets/tools/jira.svg" alt="" loading="lazy" /><span>Jira</span></div>
              <div className="tool"><img src="/assets/tools/slack.svg" alt="" loading="lazy" /><span>Slack</span></div>
            </div>
            <p className="toolwall__note">Aussi : Midjourney, ComfyUI, Capture One, Google Workspace, Canva pour les équipes qui travaillent déjà dessus.</p>
          </div>
        </section>
        {/* CLIENTS */}
        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">03</div>
              <div>
                <h2>Ils m'ont confié<br />leur marque.</h2>
                <p>Artisans, transporteurs, maisons, cabinets, indépendants. Des structures très différentes, un même besoin : un système clair, tenable, qui vieillit bien.</p>
              </div>
              <div className="side">Sélection de clients</div>
            </div>
            <div className="wall rv">
              <div className="logo-cell"><span className="mark mark--sq">RS</span><b>Raj Services</b><i>Services · Île-de-France</i></div>
              <div className="logo-cell"><span className="mark mark--cir">MP</span><b>My Prestige Transport</b><i>Transport premium</i></div>
              <div className="logo-cell"><span className="mark mark--dia">MK</span><b>Maison Kanidjian</b><i>Maison · Artisanat</i></div>
              <div className="logo-cell"><span className="mark mark--sq">CA</span><b>La Chambre Avocat</b><i>Juridique · Paris</i></div>
              <div className="logo-cell"><span className="mark mark--cir">XS</span><b>Xavier Sport Scientist</b><i>Santé · Performance</i></div>
              <div className="logo-cell"><span className="mark mark--dia">CL</span><b>Cabinet Leslec</b><i>Conseil · Expertise</i></div>
            </div>
            <p className="wall__note">Collaborations 2019 — 2026. Chaque marque est présentée par son monogramme, dans le même système graphique. Références et cas détaillés sur demande.</p>
          </div>
        </section>
        {/* ENSEIGNEMENT */}
        <section className="section section--tint">
          <div className="wrap">
            <div className="teach">
              <div className="teach__big rv">
                <div className="sec-num">04</div>
                <b>8</b>
                <span>ans à enseigner<br />ce que je pratique</span>
              </div>
              <div className="teach__list rv">
                <p className="teach__intro">La pédagogie n'est pas un à-côté. C'est ce qui m'oblige à garder des méthodes claires, documentées, transmissibles. Et ce qui m'a appris à expliquer un choix en une phrase, ce qui sert aussi en réunion client.</p>
                <div className="school"><b>MJM Graphic Design</b><i>Paris · Design graphique, direction artistique</i></div>
                <div className="school"><b>Webstart</b><i>Paris · UI/UX, Figma, culture web</i></div>
                <div className="school"><b>Supcad</b><i>Paris · PAO, chaîne graphique</i></div>
                <div className="school"><b>Digital Campus</b><i>Paris · Design digital, projets étudiants</i></div>
                <div className="school"><b>IESA Art &amp; Culture</b><i>Paris · Image, édition, médiation</i></div>
                <div className="school"><b>School Online</b><i>Distanciel · Formations courtes, IA appliquée</i></div>
              </div>
            </div>
          </div>
        </section>
        {/* PARCOURS */}
        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">05</div>
              <div>
                <h2>Cinq dates,<br />pas un roman.</h2>
                <p>Ce qui explique pourquoi je fais ce métier de cette façon, sans récit héroïque.</p>
              </div>
              <div className="side">2013 — 2026</div>
            </div>
            <div className="ab-frise rv">
              <div className="ab-frise__row"><b>2013</b><span>Installation en indépendant, Paris</span></div>
              <div className="ab-frise__row"><b>2017</b><span>Premières missions d'enseignement</span></div>
              <div className="ab-frise__row"><b>2020</b><span>Édition, packaging, direction photo</span></div>
              <div className="ab-frise__row"><b>2023</b><span>UI/UX, formations continues, automatisation</span></div>
              <div className="ab-frise__row"><b>2026</b><span>Studio, IA générative et agents</span></div>
            </div>
            <div className="ab-facts rv">
              <div className="ab-fact"><b>Formé à</b><span>PAO, édition, image, passage en agence avant l'indépendance.</span></div>
              <div className="ab-fact"><b>Manière de travailler</b><span>Un brief, deux directions maximum, une seule personne du début à la fin.</span></div>
              <div className="ab-fact"><b>En dehors du studio</b><span>Photographie argentique, typographie de signalétique, systèmes simples qui tiennent dix ans.</span></div>
            </div>
          </div>
        </section>
        <section className="cta-section" id="contact">
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
