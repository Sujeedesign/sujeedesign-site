import type { HomeContent } from "@/lib/content/schema";
import { coverOf, getProject } from "@/content/projects";

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

/**
 * Repère d'édition visuelle : `data-field` porte le chemin du champ dans
 * `app/content_model.py` (hero.kicker, studio.stats.0.value, …). Le runtime
 * (`components/editor`) lit ces attributs pour rendre la page éditable en place ;
 * sans session admin, ils restent inertes et n'alourdissent rien d'autre.
 */

/** Projet mis en avant dans l'ouverture : premier cas du portfolio. */
const featured = getProject("elerya");

/** Image du LCP de l'accueil : le fond du hero. Ses dimensions sont celles du fichier. */
export const heroPhoto = featured ? coverOf(featured) : undefined;

export function Hero({ doc }: { doc: HomeContent }) {
  const { hero } = doc;
  return (
    <header className="hero hero--proj" id="top">
      <div className="hero__bg" aria-hidden="true">
        {heroPhoto ? (
          // LCP : chargée en priorité, sans décalage de mise en page (dimensions
          // déclarées), et lue dès l'arrivée sans attendre le lazy loading.
          <img
            className="hero__photo"
            src={heroPhoto.src}
            alt=""
            width={heroPhoto.width}
            height={heroPhoto.height}
            fetchPriority="high"
            decoding="async"
          />
        ) : null}
        <span className="hero__word">{featured?.name ?? ""}</span>
      </div>
      <span className="hero__veil" aria-hidden="true"></span>
      <a
        className="hero__hit"
        href={hero.cta.href}
        aria-label={`Voir l'étude de cas ${featured?.name ?? ""}`}
      ></a>

      <div className="hero__content">
        <p className="hero__kicker" data-field="hero.kicker">
          {hero.kicker}
        </p>
        <h1 className="hero__title" id="heroTitle">
          <span data-field="hero.title.first">{hero.title.first}{" "}</span>
          <span className="hl" data-field="hero.title.highlight">
            {hero.title.highlight}{" "}
          </span>
          <span className="thin" data-field="hero.title.last">
            {hero.title.last}
          </span>
        </h1>
        <div className="hero__cols">
          <p className="hero__lead">
            <span data-field="hero.lead.text">{hero.lead.text}</span>{" "}
            <b data-field="hero.lead.strong">{hero.lead.strong}</b>
          </p>
          <a className="hero__cta" href={hero.cta.href} data-href-field="hero.cta.href">
            <span data-field="hero.cta.label">{hero.cta.label}</span>
            {arrow}
          </a>
        </div>
      </div>

      <div className="hero__tag" aria-hidden="true" data-field="hero.tag">
        {hero.tag}
      </div>
      <div className="scrollcue">
        <span className="bar" aria-hidden="true"></span>
        Défiler
      </div>
    </header>
  );
}

export function Studio({ doc }: { doc: HomeContent }) {
  const { studio } = doc;
  return (
    <section className="section" id="studio">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">01</div>
          <div>
            <h2 data-field="studio.title" data-multiline="1">
              {studio.title.map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h2>
            <p data-field="studio.intro">{studio.intro}</p>
          </div>
          <div className="side" data-field="studio.aside">
            {studio.aside}
          </div>
        </div>

        <p className="statement rv">
          <span data-field="studio.statement.text">{studio.statement.text}</span>
          <em data-field="studio.statement.emphasis">{studio.statement.emphasis}</em>
        </p>

        <div className="numbers rv">
          {studio.stats.map((stat, index) => (
            <div className="num" key={stat.label}>
              <b data-field={`studio.stats.${index}.value`}>{stat.value}</b>
              <span data-field={`studio.stats.${index}.label`}>{stat.label}</span>
              <p data-field={`studio.stats.${index}.text`}>{stat.text}</p>
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

/** Slug du projet visé par le lien d'une carte. */
function projectSlug(href: string) {
  return href.split("/").filter(Boolean).pop() ?? "";
}

/** Photo de couverture du projet, posée en fond de carte quand elle existe. */
function photoSrc(href: string) {
  const project = getProject(projectSlug(href));
  return project ? coverOf(project)?.src ?? null : null;
}

/** Visuel réel du projet quand il existe, sinon l'illustration d'origine. */
function CaseMedia({ href, kind }: { href: string; kind: "pack" | "sign" | "ui" }) {
  const slug = projectSlug(href);
  const project = getProject(slug);
  const image = project ? coverOf(project) : undefined;
  if (!image) return <CaseVisual kind={kind} />;
  return (
    <div className="case__visual case__visual--photo">
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

const caseClass: Record<string, string> = {
  paper: "case c-paper",
  signal: "case c-signal",
  ui: "case case--ui",
};

export function Cases({ doc }: { doc: HomeContent }) {
  const { cases } = doc;
  return (
    <section className="section section--tint" id="travaux">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">02</div>
          <div>
            <h2 data-field="cases.title" data-multiline="1">
              {cases.title.map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h2>
            <p data-field="cases.intro">{cases.intro}</p>
          </div>
          <div className="side">
            <a className="side__link" href={cases.aside.href} data-href-field="cases.aside.href">
              <span data-field="cases.aside.label">{cases.aside.label}</span>
            </a>
          </div>
        </div>

        <div className="stack">
          {cases.items.map((item, index) => (
            <a
              key={item.id}
              href={item.href}
              className={`${caseClass[item.tone]}${photoSrc(item.href) ? " case--photo" : ""}`}
              style={item.tone === "ui" ? { background: "#080807" } : undefined}
              aria-labelledby={item.id}
            >
              {photoSrc(item.href) ? (
                <span
                  className="case__bg"
                  aria-hidden="true"
                  style={{ backgroundImage: `url(${photoSrc(item.href)})` }}
                />
              ) : null}
              <div className="case__top">
                <span className="case__idx" data-field={`cases.items.${index}.index`}>
                  {item.index}
                </span>
                <span
                  className="case__meta"
                  data-field={`cases.items.${index}.meta`}
                  data-multiline="1"
                >
                  {item.meta.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              </div>
              <div className="case__body">
                <CaseMedia href={item.href} kind={item.visual} />
              </div>
              <div className="case__foot">
                <div className="case__text">
                  <h2
                    className="case__title"
                    id={item.id}
                    data-field={`cases.items.${index}.title`}
                  >
                    {item.title}
                  </h2>
                  <ul
                    className="case__sub"
                    data-field={`cases.items.${index}.tags`}
                    data-multiline="1"
                  >
                    {item.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                </div>
                <span className="case__cta">
                  Voir l’étude de cas <span aria-hidden="true">↗</span>
                </span>
              </div>
              <span
                className="case__ghost"
                aria-hidden="true"
                data-field={`cases.items.${index}.ghost`}
              >
                {item.ghost}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Method({ doc }: { doc: HomeContent }) {
  const { method } = doc;
  return (
    <section className="section" id="methode">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">03</div>
          <div>
            <h2 data-field="method.title">{method.title}</h2>
            <p data-field="method.intro">{method.intro}</p>
          </div>
          <div className="side" data-field="method.aside">
            {method.aside}
          </div>
        </div>

        <div className="steps rv">
          {method.steps.map((step, index) => (
            <div className="step" key={step.step}>
              <div className="k">
                <span data-field={`method.steps.${index}.step`}>{step.step}</span>
                <b data-field={`method.steps.${index}.duration`}>{step.duration}</b>
              </div>
              <h3 data-field={`method.steps.${index}.title`}>{step.title}</h3>
              <p data-field={`method.steps.${index}.text`}>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Services({ doc }: { doc: HomeContent }) {
  const { services } = doc;
  return (
    <section className="section section--tint" id="prestations">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">04</div>
          <div>
            <h2 data-field="services.title" data-multiline="1">
              {services.title.map((line, index) => (
                <span key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </span>
              ))}
            </h2>
            <p data-field="services.intro">{services.intro}</p>
          </div>
          <div className="side" data-field="services.aside">
            {services.aside}
          </div>
        </div>

        <div className="rl-svc__grid rv">
          {services.items.map((service, index) => (
            <a
              className="rl-svc__card"
              href={service.href}
              key={service.number}
              data-href-field={`services.items.${index}.href`}
            >
              <span className="rl-svc__n" data-field={`services.items.${index}.number`}>
                {service.number}
              </span>
              <h3 data-field={`services.items.${index}.title`}>{service.title}</h3>
              <p data-field={`services.items.${index}.summary`}>{service.summary}</p>
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

export function CallToAction({ doc }: { doc: HomeContent }) {
  const { cta } = doc;
  return (
    <section className="cta-section">
      <div className="wrap">
        <div className="bandcta bandcta--dark cta-glow">
          <div className="glow" aria-hidden="true"></div>
          <p data-field="cta.text">{cta.text}</p>
          <a
            className="btn-fill btn-fill--light"
            href={cta.action.href}
            data-href-field="cta.action.href"
          >
            <span data-field="cta.action.label">{cta.action.label}</span>{" "}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
