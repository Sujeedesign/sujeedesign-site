/**
 * Sommaire et film des réalisations.
 *
 * Composition : les liens rapides des projets en haut, puis chaque projet en
 * plein écran, empilé au défilement (une image glisse par-dessus la précédente).
 *
 * La liste vient du catalogue du back office (base), avec repli sur
 * `content/projects.ts` : publier une fiche dans l'admin la fait apparaître ici,
 * sur sa fiche et dans le plan du site.
 */
import type { Project } from "@/content/projects";
import { CoverPicture } from "@/components/CoverPicture";
import { pageHero, type PageDoc } from "@/content/pages";
import { realisationPath, routes } from "@/lib/routes";


const firstYear = 2013;
const countWords = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];

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

export function Realisations({ doc, projects }: { doc?: PageDoc; projects: Project[] }) {
  const hero = pageHero(doc);
  const count = projects.length;
  const countWord = countWords[count] ?? String(count);
  const countTitle = countWord.charAt(0).toUpperCase() + countWord.slice(1);
  return (
    <div>
      <header className="rl-hero">
        <div className="wrap">
          <p className="kick" data-field="hero.kicker">{hero.kicker}</p>
          <h1 className="rl-hero__title">
            <span className="rl-line">
              <span>{countTitle} projets,</span>
            </span>
            <span className="rl-line">
              <span className="thin">{countWord} systèmes.</span>
            </span>
          </h1>
          <div className="rl-hero__foot">
            <p className="rl-hero__lead">
              <span data-field="hero.lead">{hero.lead}</span>{" "}
              <b data-field="hero.lead2">{hero.lead2}</b>
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
        <div className="scrollcue scrollcue--right">
          <span className="bar" aria-hidden="true"></span>
          Défiler
        </div>
      </header>

      <nav className="rl-index" aria-label="Sommaire des projets">
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
      </nav>

      <div className="rl-film">
        {projects.map((project, i) => {
          const href = realisationPath(project.slug);
          return (
            /* Toute la surface de l'image est cliquable : la carte est le lien. */
            <a
              className={`${toneClass[project.tone] ?? toneClass.paper} rl-p--link`}
              href={href}
              id={`p${project.index}`}
              key={project.slug}
              style={{ zIndex: i + 1 }}
              aria-label={`${project.name}, voir l’étude de cas`}
            >
              <div className="rl-p__media">
                <CoverPicture
                  project={project}
                  className="rl-p__img"
                  loading={i < 2 ? "eager" : "lazy"}
                />
                <span className="rl-scene__word" aria-hidden="true">
                  {project.index}
                </span>
                {/* haut : type de projet à gauche, client et année à droite */}
                <div className="rl-p__top">
                  <p className="rl-p__type">
                    <span className="rl-p__n">{project.index}</span>
                    {" / "}
                    {project.disciplines.join(" · ")}
                  </p>
                  <p className="rl-p__client">
                    {project.client}
                    {project.year ? ` ${project.year}` : ""}
                  </p>
                </div>
                {/* bas : titre et mots clés à gauche, étude de cas à droite */}
                <div className="rl-p__foot">
                  <div className="rl-p__text">
                    <h2 className="rl-p__name">{project.name}</h2>
                    <ul className="rl-p__tags">
                      {project.tags.map((tag) => (
                        <li key={tag}>{tag}</li>
                      ))}
                    </ul>
                  </div>
                  <span className="rl-p__link">
                    Voir l’étude de cas <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </div>
            </a>
          );
        })}
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
            <a className="btn-fill btn-fill--light" href={routes.contact}>
              Prendre contact <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
