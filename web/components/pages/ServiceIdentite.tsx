import { routes } from "@/lib/routes";

/** Portage du v5 : service-identite.html. Textes pilotés par /content/services. */
export const pageMeta = {
  "title": "Identité visuelle et logo, Cergy et Paris — Sujee Design",
  "description": "Identité visuelle à Cergy, Val-d'Oise et Paris : nom, logotype, typographies, couleurs, déclinaisons et guide d'usage. Sources à votre nom."
};

type Doc = Record<string, any>;

/**
 * Entrées `FAQPage` de la page : la réponse courte (`doc.aeo`, rendue dans le
 * bloc « En bref ») puis les questions visibles de `doc.faq.items`. Une seule
 * source de vérité, donc aucune donnée structurée absente de l'écran.
 */
export function pageFaqEntries(doc: Doc) {
  const items: Doc[] = doc?.faq?.items ?? [];
  const aeo = doc?.aeo ?? {};
  return [{ question: aeo.question, answer: aeo.answer }, ...items.map((item) => ({ question: item.q, answer: item.a }))]
    .filter((entry) => Boolean(entry.question) && Boolean(entry.answer))
    .map((entry) => ({ question: String(entry.question), answer: String(entry.answer) }));
}

export function ServiceIdentite({ doc }: { doc: Doc }) {
  const hero = doc.hero ?? {};
  const aeo = doc.aeo ?? {};
  const scope = doc.scope ?? {};
  const methode = doc.methode ?? {};
  const livrables = doc.livrables ?? {};
  const terrain = doc.terrain ?? {};
  const faq = doc.faq ?? {};
  const cta = doc.cta ?? {};
  const title: string[] = hero.title ?? [];
  const scopeItems: Doc[] = scope.items ?? [];
  const steps: Doc[] = methode.steps ?? [];
  const deliverItems: Doc[] = livrables.items ?? [];
  const terrainItems: Doc[] = terrain.items ?? [];
  const faqItems: Doc[] = faq.items ?? [];

  return (
    <>
<div>
        <header className="sp-hero">
          <div className="ia-hero__mesh" aria-hidden="true" />
          <div className="wrap">
            <p className="kick ia-kick" data-field="hero.kicker"><span className="live-dot" aria-hidden="true" />{hero.kicker}</p>
            <div className="sp-hero__grid">
              <div>
                <h1 className="sp-hero__title">{title[0]} <span className="hl" data-field="hero.title.1">{title[1]}</span></h1>
                <p className="sp-hero__lead" data-field="hero.lead">{hero.lead}</p>
                <div className="sp-hero__cta">
                  <a className="btn-fill" href={routes.contact}>Parler de mon projet <span aria-hidden="true">↗</span></a>
                  <a className="btn-line" href="/services">Tous les services</a>
                </div>
              </div>
              <div className="sp-hero__fig">
                <img src="/assets/img/svc-identite-2026.jpg" alt="Planche d’identité visuelle Mathuraa Manokaran : logo en losange, palette bordeaux, typographies et applications papeterie." width={1400} height={933} />
              </div>
            </div>
            <div className="sv-hero__meta">{hero.meta?.map((m: Doc, i: number) => <div key={i}><span data-field={`hero.meta.${i}.label`}>{m.label}</span><p data-field={`hero.meta.${i}.text`}>{m.text}</p></div>)}</div>
          </div>
        </header>

        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">En bref</div>
              <div>
                <h2 data-field="aeo.question">{aeo.question}</h2>
                <p data-field="aeo.answer">{aeo.answer}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">{scope.num}</div>
              <div><h2>{scope.title?.[0]}<br />{scope.title?.[1]}</h2><p data-field="scope.lead">{scope.lead}</p></div>
              <div className="side">{scope.side}</div>
            </div>
            <div className="sp-items rv">{scopeItems.map((item, i) => <div className="sp-item" key={i}><b>{item.n}</b><div><h3 data-field={`scope.items.${i}.title`}>{item.title}</h3><p data-field={`scope.items.${i}.text`}>{item.text}</p></div></div>)}</div>
          </div>
        </section>

        <section className="section section--tint">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">{methode.num}</div>
              <div><h2>{methode.title?.[0]}</h2><p data-field="methode.lead">{methode.lead}</p></div>
              <div className="side">{methode.side}</div>
            </div>
            <div className="method rv">
              <div className="method__rail" aria-hidden="true"><span /></div>
              <div className="method__steps method__steps--4">{steps.map((step, i) => <div className="method__step" key={i}><b>{step.n}</b><span data-field={`methode.steps.${i}.title`}>{step.title}</span><i data-field={`methode.steps.${i}.text`}>{step.text}</i><em>{step.dur}</em></div>)}</div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">{livrables.num}</div>
              <div><h2>{livrables.title?.[0]}<br />{livrables.title?.[1]}</h2><p data-field="livrables.lead">{livrables.lead}</p></div>
              <div className="side">{livrables.side}</div>
            </div>
            <div className="deliver rv">
              <div className="deliver__head"><span className="mono">{livrables.side}</span><p data-field="livrables.intro">{livrables.intro}</p></div>
              <div className="deliver__cols">{deliverItems.map((item, i) => <div key={i}><b data-field={`livrables.items.${i}.title`}>{item.title}</b><span data-field={`livrables.items.${i}.text`}>{item.text}</span></div>)}</div>
            </div>
          </div>
        </section>

        <section className="section section--tint">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">{terrain.num}</div>
              <div><h2>{terrain.title?.[0]}<br />{terrain.title?.[1]}</h2><p data-field="terrain.lead">{terrain.lead}</p></div>
              <div className="side">{terrain.side}</div>
            </div>
            <div className="sp-items rv">
              {terrainItems.map((item, i) => (
                <div className="sp-item" key={i}>
                  <b>{item.n}</b>
                  <div>
                    <h3 data-field={`terrain.items.${i}.title`}>{item.title}</h3>
                    <p data-field={`terrain.items.${i}.text`}>{item.text}</p>
                    {item.link ? <a className="sv-row__more" href={item.link.href}>{item.link.label} <span aria-hidden="true">↗</span></a> : null}
                    {item.link2 ? <><br /><a className="sv-row__more" href={item.link2.href}>{item.link2.label} <span aria-hidden="true">↗</span></a></> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">{faq.num}</div>
              <div><h2>{faq.title?.[0]}<br />{faq.title?.[1]}</h2></div>
              <div className="side">{faq.side}</div>
            </div>
            <div className="faq rv">{faqItems.map((item, i) => <details key={i}><summary data-field={`faq.items.${i}.q`}>{item.q}</summary><p data-field={`faq.items.${i}.a`}>{item.a}</p></details>)}</div>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">05</div>
              <div>
                <h2>Pour aller plus loin</h2>
                <p>
                  Quatre outils pour situer votre projet avant d&apos;en parler : diagnostic du
                  logo actuel, prix réels, budget en trente secondes et brief à remplir.
                </p>
              </div>
            </div>
            <ul className="res-links rv">
              <li>
                <a href={routes.testerSonLogo}>
                  <span className="res-links__kind">Diagnostic</span>
                  <span className="res-links__title">Tester son logo</span>
                  <span className="res-links__text">
                    Lisibilité à 16 px, contraste, tenue en un seul ton. Le fichier reste dans
                    votre navigateur.
                  </span>
                </a>
              </li>
              <li>
                <a href={routes.guidePrixLogo}>
                  <span className="res-links__kind">Guide</span>
                  <span className="res-links__title">Combien coûte un logo en 2026</span>
                  <span className="res-links__text">
                    Les quatre paliers de prix, le temps de travail réel, ce qui manque à 200 €.
                  </span>
                </a>
              </li>
              <li>
                <a href={routes.calculateurBudgetIdentite}>
                  <span className="res-links__kind">Outil</span>
                  <span className="res-links__title">Calculateur de budget identité</span>
                  <span className="res-links__text">
                    Une fourchette en trente secondes, poste par poste, sans email à laisser.
                  </span>
                </a>
              </li>
              <li>
                <a href={routes.generateurBriefIdentite}>
                  <span className="res-links__kind">Outil</span>
                  <span className="res-links__title">Générateur de brief identité</span>
                  <span className="res-links__text">
                    Dix questions pour écrire un brief propre, exportable en PDF.
                  </span>
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p data-field="cta.text">{cta.text}</p>
              <a className="btn-fill btn-fill--light" href={routes.contact}>{cta.label} <span aria-hidden="true">↗</span></a>
              <div className="sp-cta__calc">
                <a href={routes.calculateurBudgetIdentite}>
                  Estimer le budget d&apos;une identité visuelle en 30 secondes
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
