/** Portage du v5 : agents-ia.html. Balisage d'origine, liens en urls propres. */
import { pageHero, line } from "@/content/pages";

const hero = pageHero("agents-ia");

export const pageMeta = {
  "title": "Agents IA & automatisation — Sujee Design",
  "description": "Agents IA auto-hébergés pour PME et indépendants : veille, devis, contenu, support. Connectés à vos outils par MCP, modèles locaux, accès contrôlés."
};

export function AgentsIa() {
  return (
    <>
<div>
        {/* HERO */}
        <header className="ia-hero">
          <div className="ia-hero__mesh" aria-hidden="true" />
          <div className="wrap">
            <p className="kick ia-kick"><span className="live-dot" aria-hidden="true" /><span data-field="hero.kicker">{hero.kicker}</span></p>
            <div className="ia-hero__grid">
              <div className="ia-hero__left">
                <h1 className="ia-hero__title"><span data-field="hero.title.0">{line(hero.title, 0, "Un agent qui fait le travail.")}</span> <br className="br-d" /><em data-field="hero.title.1">{line(hero.title, 1, "Pas une démo.")}</em></h1>
                <p className="ia-hero__lead" data-field="hero.lead">{hero.lead}</p>
                <div className="ia-hero__cta">
                  <a className="btn-fill" href="mailto:s.sujeepan.pro@gmail.com?subject=Agent%20IA">Décrire ma tâche <span aria-hidden="true">↗</span></a>
                  <a className="btn-line" href="#process">Voir la méthode</a>
                </div>
              </div>
              <div className="ia-hero__right">
                <div className="console" role="img" aria-label="Aperçu d'une session d'agents en cours">
                  <div className="console__bar">
                    <span className="console__dots" aria-hidden="true"><i /><i /><i /></span>
                    <span className="console__name">hermes · atelier</span>
                    <span className="console__live"><i />en ligne</span>
                  </div>
                  <div className="console__body">
                    <p className="ln"><span className="t">09:12</span><span className="who">veille</span><span className="msg">14 sources lues, 3 signaux retenus</span></p>
                    <p className="ln"><span className="t">09:13</span><span className="who">devis</span><span className="msg">demande qualifiée · devis prêt</span></p>
                    <p className="ln"><span className="t">09:14</span><span className="who">vous</span><span className="msg">valider le devis 2026-041 ?</span></p>
                    <p className="ln ln--ok"><span className="t">09:14</span><span className="who">devis</span><span className="msg">envoyé · CRM mis à jour</span></p>
                    <p className="ln ln--dim"><span className="t">09:15</span><span className="who">site</span><span className="msg">3 fiches produits en attente</span></p>
                    <p className="ln ln--cursor"><span className="t">09:16</span><span className="who">—</span><span className="msg">en attente de validation<i className="caret" /></span></p>
                  </div>
                  <div className="console__foot">
                    <span>4 agents</span><span>MCP · 6 outils</span><span>modèles locaux</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="ia-hero__meta">
              <div><span>Dispositif</span><p>Agents auto-hébergés sur Hermes, connectés à vos outils par MCP.</p></div>
              <div><span>Pour qui</span><p>PME, cabinets, studios et indépendants qui perdent du temps sur des tâches répétables.</p></div>
              <div><span>Délai</span><p>Premier agent en production en deux à trois semaines.</p></div>
            </div>
          </div>
        </header>
        {/* TICKER */}
        <div className="ticker" aria-hidden="true">
          <div className="ticker__track">
            <span>MCP</span><i>✦</i><span>HERMES AGENT</span><i>✦</i><span>MODÈLES LOCAUX</span><i>✦</i><span>WORDPRESS</span><i>✦</i><span>JIRA</span><i>✦</i><span>N8N</span><i>✦</i><span>OLLAMA</span><i>✦</i><span>AUTO-HÉBERGÉ</span><i>✦</i>
            <span>MCP</span><i>✦</i><span>HERMES AGENT</span><i>✦</i><span>MODÈLES LOCAUX</span><i>✦</i><span>WORDPRESS</span><i>✦</i><span>JIRA</span><i>✦</i><span>N8N</span><i>✦</i><span>OLLAMA</span><i>✦</i><span>AUTO-HÉBERGÉ</span><i>✦</i>
          </div>
        </div>
        {/* LE PROBLÈME */}
        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">01</div>
              <div>
                <h2>Ce qui bloque<br />dans 9 projets sur 10.</h2>
                <p>Ce ne sont pas les modèles. Ce sont les trois mêmes erreurs, refaites à chaque fois.</p>
              </div>
              <div className="side">Diagnostic</div>
            </div>
            <div className="rows">
              <article className="row rv">
                <span className="row__n">A</span>
                <h3>L'IA ne connaît pas votre maison</h3>
                <p>Vos tarifs, vos clients, vos documents, votre ton. Sans contexte, un modèle produit du texte générique, et vous corrigez plus que vous ne gagnez.</p>
                <div className="row__tags"><span>Contexte</span><span>Mémoire</span><span>Règles métier</span></div>
              </article>
              <article className="row rv">
                <span className="row__n">B</span>
                <h3>Les outils ne se parlent pas</h3>
                <p>Le mail arrive ici, le devis se fait là, la facture ailleurs. Un humain fait le pont. C'est exactement ce que l'agent doit faire à votre place.</p>
                <div className="row__tags"><span>MCP</span><span>API</span><span>Webhooks</span></div>
              </article>
              <article className="row rv">
                <span className="row__n">C</span>
                <h3>Personne ne veut d'une boîte noire</h3>
                <p>Un agent qui agit sans trace, sans validation et sans plan de secours ne passe pas la réunion de direction. Il faut des garde-fous visibles.</p>
                <div className="row__tags"><span>Journal</span><span>Validation</span><span>Reprise</span></div>
              </article>
            </div>
          </div>
        </section>
        {/* QUATRE AGENTS */}
        <section className="section section--tint">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">02</div>
              <div>
                <h2>Quatre agents,<br />quatre métiers.</h2>
                <p>Chaque agent traite une chaîne complète, du signal jusqu'à l'action. Pas une collection de gadgets : un poste de travail automatisé.</p>
              </div>
              <div className="side">Cas d'usage</div>
            </div>
            <div className="ai-grid">
              <article className="ai-card rv">
                <div className="ai-card__top">
                  <svg className="agenticon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <circle cx={16} cy={16} r="4.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M16 3.5v4M16 24.5v4M3.5 16h4M24.5 16h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <path d="M7.5 7.5a12 12 0 0 1 3 3M21.5 21.5a12 12 0 0 1 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
                  </svg>
                  <span className="ai-card__k">Agent 01</span>
                </div>
                <h3>Veille &amp; contenu</h3>
                <p>Il surveille vos sources, résume ce qui compte, prépare des brouillons dans votre ton et propose un calendrier de publication. Vous relisez, vous publiez.</p>
                <ul><li>Sources suivies</li><li>Briefs rédigés</li><li>Rapport hebdo</li></ul>
              </article>
              <article className="ai-card rv">
                <div className="ai-card__top">
                  <svg className="agenticon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <rect x={5} y={6} width={22} height={20} rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M10 20h5M10 16h8M10 12h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    <circle cx={22} cy={19} r="2.5" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                  <span className="ai-card__k">Agent 02</span>
                </div>
                <h3>Commercial &amp; devis</h3>
                <p>Il qualifie une demande entrante, pose les questions manquantes, prépare le devis au bon tarif et le range dans le CRM avec la bonne étiquette.</p>
                <ul><li>Formulaire vers devis</li><li>Relances</li><li>Suivi de pipeline</li></ul>
              </article>
              <article className="ai-card rv">
                <div className="ai-card__top">
                  <svg className="agenticon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <rect x={5} y={5} width={22} height={22} rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <path d="M5 12h22M12 12v15" stroke="currentColor" strokeWidth="1.3" />
                    <circle cx={21} cy={20} r="1.6" fill="currentColor" />
                  </svg>
                  <span className="ai-card__k">Agent 03</span>
                </div>
                <h3>Production &amp; site</h3>
                <p>Il prépare les fiches produits, les textes de pages et les métadonnées SEO, puis pousse dans WordPress une fois la validation donnée.</p>
                <ul><li>Fiches et pages</li><li>SEO technique</li><li>Publication contrôlée</li></ul>
              </article>
              <article className="ai-card rv">
                <div className="ai-card__top">
                  <svg className="agenticon" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                    <path d="M6 8h20v13H14l-6 5v-5H6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <path d="M11 13h10M11 17h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                  <span className="ai-card__k">Agent 04</span>
                </div>
                <h3>Support &amp; administratif</h3>
                <p>Il répond aux questions récurrentes, trie la boîte, prépare les échéances et vous alerte quand quelque chose bloque depuis trop longtemps.</p>
                <ul><li>Tri de boîte</li><li>Réponses types</li><li>Alertes</li></ul>
              </article>
            </div>
          </div>
        </section>
        {/* LE FLUX */}
        <section className="section flow-sec">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">03</div>
              <div>
                <h2>Du signal<br />à l'action.</h2>
                <p>Un agent ne répond pas à une question : il traverse une chaîne. Sources, décision, validation, exécution. Voilà le trajet réel d'une tâche.</p>
              </div>
              <div className="side">Architecture</div>
            </div>
            <div className="flow rv">
              <svg className="flow__svg" viewBox="0 0 1200 400" role="img" aria-label="Schéma : quatre sources entrent dans un agent, trois sorties sont validées">
                <defs>
                  <marker id="arw" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
                    <path d="M0 0.6 L7 4 L0 7.4 z" fill="#0A0A0B" fill-opacity=".5" />
                  </marker>
                </defs>
                <g className="node">
                  <rect x={20} y={52} width={150} height={40} rx={2} />
                  <text x={95} y={77}>MAIL</text>
                </g>
                <g className="node">
                  <rect x={20} y={140} width={150} height={40} rx={2} />
                  <text x={95} y={165}>DRIVE</text>
                </g>
                <g className="node">
                  <rect x={20} y={228} width={150} height={40} rx={2} />
                  <text x={95} y={253}>CRM</text>
                </g>
                <g className="node">
                  <rect x={20} y={316} width={150} height={40} rx={2} />
                  <text x={95} y={341}>WORDPRESS</text>
                </g>
                <g className="wires">
                  <path id="p1" d="M170 72 C 380 72, 430 160, 545 190" marker-end="url(#arw)" />
                  <path id="p2" d="M170 160 C 340 160, 420 178, 545 193" marker-end="url(#arw)" />
                  <path id="p3" d="M170 248 C 340 248, 420 212, 545 200" marker-end="url(#arw)" />
                  <path id="p4" d="M170 336 C 380 336, 430 226, 545 205" marker-end="url(#arw)" />
                </g>
                <g className="wires wires--out">
                  <path id="q1" d="M655 190 C 800 190, 850 118, 1000 112" marker-end="url(#arw)" />
                  <path id="q2" d="M655 196 C 820 196, 860 196, 1000 196" marker-end="url(#arw)" />
                  <path id="q3" d="M655 202 C 800 202, 850 282, 1000 288" marker-end="url(#arw)" />
                </g>
                <circle className="pulse" r="3.4"><animateMotion dur="4s" repeatCount="indefinite" begin="0s"><mpath href="#p1" /></animateMotion></circle>
                <circle className="pulse" r="3.4"><animateMotion dur="4.6s" repeatCount="indefinite" begin=".7s"><mpath href="#p2" /></animateMotion></circle>
                <circle className="pulse" r="3.4"><animateMotion dur="5.2s" repeatCount="indefinite" begin="1.4s"><mpath href="#p3" /></animateMotion></circle>
                <circle className="pulse" r="3.4"><animateMotion dur="4.2s" repeatCount="indefinite" begin="2.1s"><mpath href="#p4" /></animateMotion></circle>
                <circle className="pulse pulse--out" r={3}><animateMotion dur="4.4s" repeatCount="indefinite" begin=".4s"><mpath href="#q1" /></animateMotion></circle>
                <circle className="pulse pulse--out" r={3}><animateMotion dur="5s" repeatCount="indefinite" begin="1.1s"><mpath href="#q2" /></animateMotion></circle>
                <circle className="pulse pulse--out" r={3}><animateMotion dur="4.8s" repeatCount="indefinite" begin="1.8s"><mpath href="#q3" /></animateMotion></circle>
                <g className="core">
                  <circle className="core__ring core__ring--out" cx={600} cy={197} r={100} />
                  <circle className="core__ring" cx={600} cy={197} r={80} />
                  <circle className="core__disc" cx={600} cy={197} r={56} />
                  <circle className="core__dot" cx={600} cy={197} r={6} />
                  <text className="core__label" x={600} y={216}>AGENT</text>
                </g>
                <text className="core__sub" x={600} y={330}>Hermes · mémoire · règles · journal</text>
                <g className="node node--out">
                  <rect x={1000} y={92} width={150} height={40} rx={2} />
                  <text x={1075} y={117}>DEVIS</text>
                </g>
                <g className="node node--out">
                  <rect x={1000} y={176} width={150} height={40} rx={2} />
                  <text x={1075} y={201}>PUBLICATION</text>
                </g>
                <g className="node node--out">
                  <rect x={1000} y={268} width={150} height={40} rx={2} />
                  <text x={1075} y={293}>ALERTE</text>
                </g>
                <text className="flow__cap" x={95} y={26}>ENTRÉES</text>
                <text className="flow__cap" x={1075} y={26}>SORTIES VALIDÉES</text>
              </svg>
              <ol className="flow__mob">
                <li><b>Entrées</b><span>Mail, Drive, CRM, WordPress</span></li>
                <li><b>Agent</b><span>Hermes, mémoire, règles, journal</span></li>
                <li><b>Sorties validées</b><span>Devis, publication, alerte</span></li>
              </ol>
            </div>
          </div>
        </section>
        {/* SOUS LE CAPOT */}
        <section className="section section--ink">
          <div className="wrap">
            <div className="sec-head sec-head--dark rv">
              <div className="sec-num">04</div>
              <div>
                <h2>Sous le capot.</h2>
                <p>Le dispositif tient en trois choix techniques. Ce sont eux qui font la différence entre un gadget et un outil de production.</p>
              </div>
              <div className="side">Hermes Agent</div>
            </div>
            <div className="rack rv">
              <div className="rack__bar">
                <span className="rack__title">hermes · flotte</span>
                <span className="rack__status"><i />4 profils actifs · 0 incident</span>
              </div>
              <div className="rack__grid">
                <div className="rack__col">
                  <div className="rack__head"><span className="led" />Une flotte, pas un chatbot</div>
                  <p>Plusieurs profils séparés : veille, projets, administratif, chacun avec son bot, ses compétences et ses accès. Un agent ne voit pas les données qu'il n'a pas à voir.</p>
                  <div className="rack__chips"><span>veille</span><span>projets</span><span>admin</span></div>
                </div>
                <div className="rack__col">
                  <div className="rack__head"><span className="led led--2" />Vos outils, connectés</div>
                  <p>WordPress, Jira, CRM, Drive, agenda, mails. L'agent lit, propose, et n'écrit qu'après validation sur les actions sensibles.</p>
                  <div className="rack__chips"><span>MCP</span><span>6 outils</span><span>lecture seule</span></div>
                </div>
                <div className="rack__col">
                  <div className="rack__head"><span className="led led--3" />Le coût reste maîtrisé</div>
                  <p>Les tâches mécaniques tournent sur des modèles locaux, gratuits. Le cloud n'est appelé que pour le jugement. Chaque exécution est tracée.</p>
                  <div className="rack__chips"><span>local</span><span>cloud</span><span>journal</span></div>
                </div>
              </div>
              <div className="rack__foot">
                <span>uptime 99,9 %</span><span>journal complet</span><span>bouton d'arrêt</span><span>auto-hébergé</span>
              </div>
            </div>
          </div>
        </section>
        {/* MÉTHODE */}
        <section className="section section--tint" id="process">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">05</div>
              <div>
                <h2>Quatre étapes,<br />deux à trois semaines.</h2>
                <p>On ne commence jamais par la technique. On commence par la tâche qui vous coûte le plus de temps chaque semaine.</p>
              </div>
              <div className="side">Méthode</div>
            </div>
            <div className="method rv">
              <div className="method__rail" aria-hidden="true"><span /></div>
              <div className="method__steps">
                <div className="method__step"><b>01</b><span>Cadrage</span><i>Une heure pour lister ce qui se répète, chiffrer le temps perdu et choisir une seule tâche.</i></div>
                <div className="method__step"><b>02</b><span>Prototype</span><i>Un agent limité à cette tâche, testé sur vos vrais documents, vos vrais mails.</i></div>
                <div className="method__step"><b>03</b><span>Mise en production</span><i>Accès restreints, validations, journalisation, plan de secours si l'agent tombe.</i></div>
                <div className="method__step"><b>04</b><span>Transmission</span><i>Vous savez le relancer, le corriger et l'étendre sans moi. Documentation incluse.</i></div>
              </div>
            </div>
          </div>
        </section>
        {/* ROI */}
        <section className="section" id="roi">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">06</div>
              <div>
                <h2>Ce que ça vous rend,<br />en euros.</h2>
                <p>Un agent ne s'ajoute pas à la pile des outils : il retire du temps payé. Mettez vos chiffres, l'ordre de grandeur apparaît.</p>
              </div>
              <div className="side">Simulation</div>
            </div>
            <div className="roi rv">
              <div className="roi__panel">
                <div className="roi__field">
                  <div className="roi__lab"><span>Heures perdues par semaine</span><output id="roiHoursOut">12 h</output></div>
                  <input type="range" id="roiHours" min={1} max={40} step={1} defaultValue={12} aria-label="Heures perdues par semaine" />
                  <div className="roi__scale"><span>1 h</span><span>40 h</span></div>
                </div>
                <div className="roi__field">
                  <div className="roi__lab"><span>Personnes concernées</span><output id="roiPeopleOut">2</output></div>
                  <input type="range" id="roiPeople" min={1} max={10} step={1} defaultValue={2} aria-label="Nombre de personnes concernées" />
                  <div className="roi__scale"><span>1</span><span>10</span></div>
                </div>
                <div className="roi__field">
                  <div className="roi__lab"><span>Coût horaire chargé</span><output id="roiCostOut">35 €</output></div>
                  <input type="range" id="roiCost" min={15} max={120} step={5} defaultValue={35} aria-label="Coût horaire chargé" />
                  <div className="roi__scale"><span>15 €</span><span>120 €</span></div>
                </div>
                <p className="roi__foot">Base : 46 semaines travaillées, 70 % du temps récupéré.</p>
              </div>
              <div className="roi__out" aria-live="polite">
                <span className="roi__kick">Économie estimée</span>
                <b className="roi__big" id="roiYear">27 048 €</b>
                <i className="roi__unit">par an</i>
                <div className="roi__rows">
                  <div><span>Heures récupérées</span><b id="roiHoursYear">773 h</b></div>
                  <div><span>Jours de travail</span><b id="roiDays">110 j</b></div>
                  <div><span>Équivalent temps plein</span><b><span id="roiEtp">0,48</span> ETP</b></div>
                </div>
                <p className="roi__note">Estimation prudente, pas une promesse. Le vrai gain se mesure sur votre tâche, après le prototype.</p>
              </div>
            </div>
          </div>
        </section>
        {/* RÉSULTATS */}
        <section className="section section--tint">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">07</div>
              <div>
                <h2>Ce que ça change<br />vraiment.</h2>
                <p>Trois effets mesurables, et deux choses que je refuse de faire.</p>
              </div>
              <div className="side">Résultats</div>
            </div>
            <div className="outcomes rv">
              <div className="outcome"><b>Du temps rendu</b><p>Les tâches répétables sortent de votre semaine. Deux à six heures par semaine sur un seul agent bien cadré.</p></div>
              <div className="outcome"><b>Vos données restent chez vous</b><p>Auto-hébergement, modèles locaux quand c'est possible, accès nominatifs. Rien ne part par défaut chez un fournisseur.</p></div>
              <div className="outcome"><b>Vous gardez la main</b><p>Chaque action sensible passe par une validation. Vous pouvez couper un agent en une commande, sans casser le reste.</p></div>
            </div>
            <div className="limits rv">
              <div><b>Ce que je ne promets pas</b><p>Un agent ne remplace pas un métier. Il enlève la partie mécanique, il ne décide pas à votre place, et il ne compense pas un process qui n'existe pas.</p></div>
              <div><b>Ce que je ne fais pas</b><p>Pas de dépendance à une plateforme fermée, pas de données clients envoyées à l'aveugle, pas de mise en production sans journal ni bouton d'arrêt.</p></div>
            </div>
          </div>
        </section>
        {/* FAQ */}
        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">08</div>
              <div>
                <h2>Les questions<br />qui reviennent.</h2>
              </div>
              <div className="side">FAQ</div>
            </div>
            <div className="faq rv">
              <details>
                <summary>Il faut un serveur et des compétences techniques ?</summary>
                <p>Non. J'installe et je maintiens l'infrastructure, sur un serveur dédié ou sur le vôtre. Vous gardez un accès administrateur et une documentation pour reprendre la main quand vous voulez.</p>
              </details>
              <details>
                <summary>Mes données partent-elles chez OpenAI ou Google ?</summary>
                <p>Pas par défaut. Les traitements courants tournent sur des modèles locaux installés sur la machine. Quand un modèle externe est nécessaire, c'est explicite, limité au strict nécessaire et documenté.</p>
              </details>
              <details>
                <summary>Qu'est-ce qui se passe si l'agent se trompe ?</summary>
                <p>Les actions sensibles demandent une validation humaine. Tout est journalisé : on peut relire ce qu'il a fait, revenir en arrière et corriger la règle. Un bouton d'arrêt coupe l'agent sans toucher au reste du site.</p>
              </details>
              <details>
                <summary>Combien de temps avant le premier résultat ?</summary>
                <p>Deux à trois semaines pour un premier agent en production, cadrage inclus. Le prototype arrive généralement en une semaine, sur une tâche volontairement étroite.</p>
              </details>
            </div>
          </div>
        </section>
        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p>Combien d'heures perdez-vous chaque semaine ?</p>
              <a className="btn-fill btn-fill--light" href="#roi">Estimer mes gains <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>
      </div>

    </>
  );
}
