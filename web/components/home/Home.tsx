import { homeContent } from "@/content/home";

const arrow = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 12h14m0 0-6-6m6 6-6 6"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const { hero, studio, cases, method, services, cta } = homeContent;

export function Hero() {
  return (
    <header className="hero hero--proj" id="top">
      <div className="hero__bg" aria-hidden="true">
        <div className="hero__still">
          <div className="hpack hp-a">
            <span className="hp-lbl">Vaasam</span>
            <b>Cumin</b>
            <em>100 g</em>
          </div>
          <div className="hpack hp-b">
            <span className="hp-lbl">Vaasam</span>
            <b>Curry</b>
            <em>250 g</em>
          </div>
          <div className="hpack hp-c">
            <span className="hp-lbl">Vaasam</span>
            <b>Safran</b>
            <em>500 g</em>
          </div>
        </div>
        <span className="hero__word">Vaasam</span>
      </div>
      <span className="hero__veil" aria-hidden="true"></span>
      <a
        className="hero__hit"
        href={hero.cta.href}
        aria-label="Voir l'étude de cas Vaasam Paris"
      ></a>

      <div className="hero__content">
        <p className="hero__kicker">{hero.kicker}</p>
        <h1 className="hero__title" id="heroTitle">
          <span>{hero.title.first}{" "}</span>
          <span className="hl">{hero.title.highlight}{" "}</span>
          <span className="thin">{hero.title.last}</span>
        </h1>
        <div className="hero__cols">
          <p className="hero__lead">
            {hero.lead.text}
            <b>{hero.lead.strong}</b>
          </p>
          <a className="hero__cta" href={hero.cta.href}>
            {hero.cta.label}
            {arrow}
          </a>
        </div>
      </div>

      <div className="hero__tag" aria-hidden="true">
        {hero.tag}
      </div>
      <div className="scrollcue">
        <span className="bar" aria-hidden="true"></span>
        Défiler
      </div>
    </header>
  );
}

export function Studio() {
  return (
    <section className="section" id="studio">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">01</div>
          <div>
            <h2>
              {studio.title.map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h2>
            <p>{studio.intro}</p>
          </div>
          <div className="side">{studio.aside}</div>
        </div>

        <p className="statement rv">
          {studio.statement.text}
          <em>{studio.statement.emphasis}</em>
        </p>

        <div className="numbers rv">
          {studio.stats.map((stat) => (
            <div className="num" key={stat.label}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
              <p>{stat.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Visuel décoratif de chaque cas : packaging, enseigne, interface. */
function CaseVisual({ kind }: { kind: "pack" | "sign" | "ui" }) {
  if (kind === "pack") {
    return (
      <div className="case__visual vis-pack" aria-hidden="true">
        <div className="pk pk-2">
          <span className="band">Vaasam</span>
          <span className="band2">250 g</span>
        </div>
        <div className="pk pk-1">
          <span className="band">Vaasam</span>
          <span className="band2">40 réf.</span>
        </div>
        <div className="pk pk-3">
          <span className="band">Vaasam</span>
          <span className="band2">Paris</span>
        </div>
      </div>
    );
  }

  if (kind === "sign") {
    return (
      <div className="case__visual vis-sign" aria-hidden="true">
        <div className="store">
          <div className="shutter"></div>
          <div className="sign">
            <span className="sign-top">Restauration africaine</span>
            <b>RFA</b>
            <span className="sign-bot">Paris · Dakar</span>
          </div>
          <div className="floor"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="case__visual vis-ui" aria-hidden="true">
      <div className="win">
        <div className="win-top">
          <i></i>
          <i></i>
          <i></i>
          <span>atelier24.app / sessions</span>
        </div>
        <div className="win-body">
          <div className="rail">
            <b></b>
            <b></b>
            <b></b>
            <b></b>
          </div>
          <div className="pane">
            <div className="pane-head">
              <span className="pt">Sessions</span>
              <span className="pill">En ligne</span>
            </div>
            <div className="kpis">
              <div className="kpi">
                <em>12</em>
                <small>sessions</small>
              </div>
              <div className="kpi">
                <em>4 h</em>
                <small>médiane</small>
              </div>
            </div>
            <div className="chart">
              <div className="bars">
                <i style={{ height: "38%" }}></i>
                <i style={{ height: "62%" }}></i>
                <i style={{ height: "45%" }}></i>
                <i style={{ height: "82%" }}></i>
                <i style={{ height: "56%" }}></i>
              </div>
              <div className="axis">
                <span>L</span>
                <span>M</span>
                <span>M</span>
                <span>J</span>
                <span>V</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const caseClass: Record<string, string> = {
  paper: "case c-paper",
  signal: "case c-signal",
  ui: "case case--ui",
};

export function Cases() {
  return (
    <section className="section section--tint" id="travaux">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">02</div>
          <div>
            <h2>
              {cases.title.map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h2>
            <p>{cases.intro}</p>
          </div>
          <div className="side">
            <a className="side__link" href={cases.aside.href}>
              {cases.aside.label}
            </a>
          </div>
        </div>

        <div className="stack">
          {cases.items.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={caseClass[item.tone]}
              style={item.tone === "ui" ? { background: "#080807" } : undefined}
              aria-labelledby={item.id}
            >
              <div className="case__top">
                <span className="case__idx">{item.index}</span>
                <span className="case__meta">
                  {item.meta.map((line, index) => (
                    <span key={line}>
                      {index > 0 ? <br /> : null}
                      {line}
                    </span>
                  ))}
                </span>
              </div>
              <div className="case__body">
                <div className="case__text">
                  <h2 className="case__title" id={item.id}>
                    {item.title}
                  </h2>
                  <div className="case__sub">
                    {item.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <CaseVisual kind={item.visual} />
              </div>
              <div className="case__bar">
                <span className="go">
                  Voir le projet <span aria-hidden="true">↗</span>
                </span>
                <span>{item.barLabel}</span>
              </div>
              <span className="case__ghost" aria-hidden="true">
                {item.ghost}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Method() {
  return (
    <section className="section" id="methode">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">03</div>
          <div>
            <h2>{method.title}</h2>
            <p>{method.intro}</p>
          </div>
          <div className="side">{method.aside}</div>
        </div>

        <div className="steps rv">
          {method.steps.map((step) => (
            <div className="step" key={step.step}>
              <div className="k">
                <span>{step.step}</span>
                <b>{step.duration}</b>
              </div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Services() {
  return (
    <section className="section section--tint" id="prestations">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">04</div>
          <div>
            <h2>
              {services.title.map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h2>
            <p>{services.intro}</p>
          </div>
          <div className="side">{services.aside}</div>
        </div>

        <div className="rl-svc__grid rv">
          {services.items.map((service) => (
            <a className="rl-svc__card" href={service.href} key={service.number}>
              <span className="rl-svc__n">{service.number}</span>
              <h3>{service.title}</h3>
              <p>{service.summary}</p>
              <span className="rl-svc__a" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CallToAction() {
  return (
    <section className="cta-section">
      <div className="wrap">
        <div className="bandcta bandcta--dark cta-glow">
          <div className="glow" aria-hidden="true"></div>
          <p>{cta.text}</p>
          <a className="btn-fill btn-fill--light" href={cta.action.href}>
            {cta.action.label} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
