/** Portage du v5 : services.html. Contenu piloté par `content/services.json`. */
import type servicesJson from "@/content/services.json";

type Dict = Record<string, any>;
export type ServicesDoc = typeof servicesJson;

/** Valeur de contenu enregistrée, sinon le texte de repli du gabarit. */
function read(D: Dict) {
  const v = <T,>(path: string, fallback: T): T => {
    const found = path.split(".").reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), D);
    return found === undefined || found === null || found === "" ? fallback : (found as T);
  };
  const arr = (path: string, fallback: string[]): string[] => {
    const found = v<string[]>(path, fallback);
    return Array.isArray(found) && found.length ? found : fallback;
  };

  const hero = {
    kicker: v("hero.kicker", "Services · Périmètre écrit"),
    title: arr("hero.title", ["Cinq métiers,", "un seul interlocuteur."]),
    lead: v("hero.lead", "Le périmètre est écrit avant de commencer."),
    meta: v("hero.meta", [] as { label: string; text: string }[]),
  };

  const prestations = {
    num: v("prestations.num", "01"),
    title: arr("prestations.title", ["Cinq façons", "de travailler ensemble."]),
    lead: v("prestations.lead", ""),
    side: v("prestations.side", "Prestations"),
    rows: v("prestations.rows", [] as Dict[]),
  };

  const methode = {
    num: v("methode.num", "02"),
    title: arr("methode.title", ["Comment ça", "se passe."]),
    lead: v("methode.lead", ""),
    side: v("methode.side", "Méthode"),
    steps: v("methode.steps", [] as Dict[]),
  };

  const livrables = {
    intro: v("livrables.intro", ""),
    items: v("livrables.items", [] as Dict[]),
  };

  const faq = {
    num: v("faq.num", "03"),
    title: arr("faq.title", ["Les questions", "qui reviennent."]),
    lead: v("faq.lead", ""),
    side: v("faq.side", "FAQ"),
    items: v("faq.items", [] as Dict[]),
  };

  const cta = {
    text: v("cta.text", ""),
    label: v("cta.label", "Décrire mon besoin"),
    href: v("cta.href", "mailto:s.sujeepan.pro@gmail.com?subject=Un%20projet"),
  };

  return { hero, prestations, methode, livrables, faq, cta };
}

const MEDIA = [
  { src: "/assets/img/svc-identite.jpg", alt: "Papeterie de marque : cartes, monogramme embossé et nuancier, sur fond papier." },
  { src: "/assets/img/svc-da.jpg", alt: "Tirages photo, planches contact et repères de cadrage sur papier." },
  { src: "/assets/img/svc-site.jpg", alt: "Maquettes imprimées d'une grille de page web et onglet vermillon." },
  { src: "/assets/img/svc-contenu.jpg", alt: "Revue ouverte, appareil photo et notes adhésives vermillon." },
  { src: "/assets/img/svc-agents.jpg", alt: "Bloc mat anthracite à diode vermillon, câble fin sur papier clair." },
];

export const pageMeta = {
  "title": "Services — identité, web, contenu et IA",
  "description": "Identité de marque, direction artistique, sites WordPress et Shopify, contenu, agents IA. Périmètre écrit, livraison documentée, sources à votre nom."
};

export function Services({ doc }: { doc: ServicesDoc }) {
  const { hero, prestations, methode, livrables, faq, cta } = read(doc as Dict);
  return (
    <>
<div>
        <header className="sv-hero">
          <div className="wrap">
            <p className="kick ia-kick"><span className="live-dot" aria-hidden="true" /><span data-field="hero.kicker">{hero.kicker}</span></p>
            <div className="sv-hero__grid">
              <div>
                <h1 className="sv-hero__title"><span data-field="hero.title.0">{hero.title[0]}</span><br /><span className="hl" data-field="hero.title.1">{hero.title[1]}</span></h1>
                <p className="sv-hero__lead" data-field="hero.lead">{hero.lead}</p>
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
              {hero.meta.map((item, i) => (
                <div key={i}>
                  <span data-field={`hero.meta.${i}.label`}>{item.label}</span>
                  <p data-field={`hero.meta.${i}.text`}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </header>
        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num" data-field="prestations.num">{prestations.num}</div>
              <div>
                <h2><span data-field="prestations.title.0">{prestations.title[0]}</span><br /><span data-field="prestations.title.1">{prestations.title[1]}</span></h2>
                <p data-field="prestations.lead">{prestations.lead}</p>
              </div>
              <div className="side" data-field="prestations.side">{prestations.side}</div>
            </div>
            <div className="sv-rows">
              {prestations.rows.map((row, i) => {
                const media = MEDIA[i] ?? { src: "/assets/img/svc-identite.jpg", alt: "" };
                return (
                  <a className="sv-row rv" href={row.href} key={i}>
                    <div className="sv-row__body">
                      <div className="sv-row__top"><span className="sv-row__n" data-field={`prestations.rows.${i}.n`}>{row.n}</span><span className="sv-row__dur" data-field={`prestations.rows.${i}.dur`}>{row.dur}</span></div>
                      <h3 data-field={`prestations.rows.${i}.title`}>{row.title}</h3>
                      <p data-field={`prestations.rows.${i}.summary`}>{row.summary}</p>
                      <ul className="sv-tags">{(row.tags ?? []).map((tag: string, j: number) => <li key={j} data-field={`prestations.rows.${i}.tags.${j}`}>{tag}</li>)}</ul>
                      <span className="sv-row__more" data-field={`prestations.rows.${i}.more`}>{row.more} <span aria-hidden="true">↗</span></span>
                    </div>
                    <div className="sv-row__media">
                      <img src={media.src} alt={media.alt} width={1400} height={933} loading="lazy" decoding="async" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
        <section className="section section--tint">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num" data-field="methode.num">{methode.num}</div>
              <div>
                <h2><span data-field="methode.title.0">{methode.title[0]}</span><br /><span data-field="methode.title.1">{methode.title[1]}</span></h2>
                <p data-field="methode.lead">{methode.lead}</p>
              </div>
              <div className="side" data-field="methode.side">{methode.side}</div>
            </div>
            <div className="method rv">
              <div className="method__rail" aria-hidden="true"><span /></div>
              <div className="method__steps method__steps--3">
                {methode.steps.map((step, i) => (
                  <div className="method__step" key={i}>
                    <b data-field={`methode.steps.${i}.n`}>{step.n}</b>
                    <span data-field={`methode.steps.${i}.title`}>{step.title}</span>
                    <i data-field={`methode.steps.${i}.text`}>{step.text}</i>
                    <em data-field={`methode.steps.${i}.dur`}>{step.dur}</em>
                  </div>
                ))}
              </div>
            </div>
            <div className="deliver rv">
              <div className="deliver__head">
                <span className="mono">Ce que vous gardez</span>
                <p data-field="livrables.intro">{livrables.intro}</p>
              </div>
              <div className="deliver__cols">
                {livrables.items.map((item, i) => (
                  <div key={i}>
                    <b data-field={`livrables.items.${i}.title`}>{item.title}</b>
                    <span data-field={`livrables.items.${i}.text`}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <section className="section">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num" data-field="faq.num">{faq.num}</div>
              <div>
                <h2><span data-field="faq.title.0">{faq.title[0]}</span><br /><span data-field="faq.title.1">{faq.title[1]}</span></h2>
                <p data-field="faq.lead">{faq.lead}</p>
              </div>
              <div className="side" data-field="faq.side">{faq.side}</div>
            </div>
            <div className="faq rv">
              {faq.items.map((item, i) => (
                <details key={i}>
                  <summary data-field={`faq.items.${i}.q`}>{item.q}</summary>
                  <p data-field={`faq.items.${i}.a`}>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p data-field="cta.text">{cta.text}</p>
              <a className="btn-fill btn-fill--light" href={cta.href}>{cta.label} <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </section>
      </div>

    </>
  );
}
