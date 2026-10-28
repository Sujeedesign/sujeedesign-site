/**
 * Sommaire et film des réalisations.
 *
 * La liste vient de `content/projects.ts` : ajouter un projet le publie ici,
 * sur sa fiche et dans le plan du site.
 */
import { projects } from "@/content/projects";
import { realisationPath } from "@/lib/routes";

const count = projects.length;
const firstYear = 2013;
const countWords = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];
const countWord = countWords[count] ?? String(count);
const countTitle = countWord.charAt(0).toUpperCase() + countWord.slice(1);

export const pageMeta = {
  title: "Réalisations — identité, web, packaging",
  description:
    "Les projets livrés par Sujee Design : identité, packaging, site, interface, édition, jeu web. Le détail de chaque système, du brief au résultat.",
};

const toneClass: Record<string, string> = {
  paper: "rl-p rl-p--paper",
  tint: "rl-p rl-p--tint",
  dark: "rl-p rl-p--dark",
};

export function Realisations() {
  return (
    <>
      <div>
        <header className="rl-hero">
          <div className="wrap">
            <p className="kick">Réalisations · 2013 — 2026</p>
            <h1 className="rl-hero__title">
              <span className="rl-line">
                <span>{countTitle} projets,{" "}</span>
              </span>
              <span className="rl-line">
                <span className="thin">{countWord} systèmes.</span>
              </span>
            </h1>
            <div className="rl-hero__foot">
              <p className="rl-hero__lead">
                Identité, packaging, site, interface, édition, jeu web. Tout est livré, en ligne ou en rayon.{" "}
                <b>Rien n’est une maquette de concours.</b>
              </p>
              <div className="rl-hero__nums">
                <div>
                  <b>{String(count).padStart(2, "0")}</b>
                  <span>projets</span>
                </div>
                <div>
                  <b>05</b>
                  <span>métiers</span>
                </div>
                <div>
                  <b>{new Date().getFullYear() - firstYear}</b>
                  <span>ans</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="rl-index" aria-label="Sommaire des projets">
          <div className="wrap">
            {projects.map((project) => (
              <a className="rl-row" href={realisationPath(project.slug)} key={project.slug}>
                <span className="rl-row__n">{project.index}</span>
                <span className="rl-row__name">{project.name}</span>
                <span className="rl-row__tags">{project.disciplines.join(" · ")}</span>
                <span className="rl-row__y">{project.year ?? ""}</span>
                <span className="rl-row__a" aria-hidden="true">
                  ↗
                </span>
              </a>
            ))}
          </div>
        </section>

        <div className="rl-film">
          {projects.map((project) => (
            <section className={toneClass[project.tone] ?? toneClass.paper} id={`p${project.index}`} key={project.slug}>
              <div className="rl-p__media">
                <div className="rl-scene">
                  <img
                    className="rl-p__img"
                    src={project.images[0]?.src}
                    alt={project.images[0]?.alt ?? project.name}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="rl-scene__word" aria-hidden="true">
                    {project.name}
                  </span>
                </div>
                <div className="rl-p__info">
                  <p className="rl-p__kicker">
                    {project.index} · {project.disciplines[0]}
                    {project.year ? ` · ${project.year}` : ""}
                  </p>
                  <h2>{project.name}</h2>
                  <p className="rl-p__desc">{project.pitch}</p>
                  <ul className="rl-p__tags">
                    {project.disciplines.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                  <a className="rl-p__link" href={realisationPath(project.slug)}>
                    Voir l’étude de cas <span aria-hidden="true">↗</span>
                  </a>
                </div>
              </div>
            </section>
          ))}
        </div>

        <section className="rl-svc">
          <div className="wrap">
            <div className="sec-head rv">
              <div className="sec-num">09</div>
              <div>
                <h2>
                  Ces projets
                  <br />
                  en appellent d’autres.
                </h2>
                <p>
                  Chaque projet ci-dessus est passé par un ou plusieurs de ces métiers. Ils se prennent seuls, ou dans
                  l’ordre.
                </p>
              </div>
              <div className="side">Prestations</div>
            </div>
            <div className="rl-svc__grid rv">
              <a className="rl-svc__card" href="/services/identite-de-marque">
                <span className="rl-svc__n">01</span>
                <h3>Identité de marque</h3>
                <p>Nom, logotype, typographie, couleurs, guide d’usage.</p>
                <span className="rl-svc__a" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a className="rl-svc__card" href="/services/direction-artistique">
                <span className="rl-svc__n">02</span>
                <h3>Direction artistique</h3>
                <p>Print, éditions, campagnes, photographie.</p>
                <span className="rl-svc__a" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a className="rl-svc__card" href="/services/site-ecommerce">
                <span className="rl-svc__n">03</span>
                <h3>Site &amp; e-commerce</h3>
                <p>Design, intégration, SEO technique, formation.</p>
                <span className="rl-svc__a" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a className="rl-svc__card" href="/services/contenu-reseaux">
                <span className="rl-svc__n">04</span>
                <h3>Contenu &amp; réseaux</h3>
                <p>Ligne éditoriale, gabarits, production régulière.</p>
                <span className="rl-svc__a" aria-hidden="true">
                  ↗
                </span>
              </a>
              <a className="rl-svc__card" href="/agents-ia">
                <span className="rl-svc__n">05</span>
                <h3>Agents IA</h3>
                <p>Automatisations, assistants internes, formation.</p>
                <span className="rl-svc__a" aria-hidden="true">
                  ↗
                </span>
              </a>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="wrap">
            <div className="bandcta bandcta--dark cta-glow">
              <div className="glow" aria-hidden="true" />
              <p>Le prochain projet, c’est le vôtre ?</p>
              <a className="btn-fill btn-fill--light" href="mailto:s.sujeepan.pro@gmail.com?subject=Un%20projet">
                Prendre contact <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
