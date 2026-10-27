import type { Project } from "@/content/projects";
import { nextProject } from "@/content/projects";
import { routes } from "@/lib/routes";

/** Métadonnées d'une étude de cas, dérivées de sa fiche. */
export function projectMeta(project: Project): { title: string; description: string } {
  const year = project.year && !project.name.includes(project.year) ? ` (${project.year})` : "";
  return {
    title: `${project.name}${year} — ${project.disciplines.join(", ")}`,
    description: project.pitch,
  };
}

export function ProjetCase({ project }: { project: Project }) {
  const next = nextProject(project.slug);
  const meta = [
    { label: "Client", value: project.client },
    { label: "Année", value: project.year },
    { label: "Périmètre", value: project.scope },
    { label: "Durée", value: project.duration },
  ].filter((item) => Boolean(item.value));

  return (
    <div>
      <header className="proj-head">
        <div className="wrap">
          <p className="kick">
            <span>Projet {project.index}</span>
            <span>{project.disciplines.join(" · ")}</span>
            {project.city ? <span>{project.city}</span> : null}
          </p>
          <h1>{project.name}</h1>
          <p className="sub">{project.pitch}</p>
          <dl className="meta-grid">
            {meta.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <div className="pj-gallery">
            {project.images.map((image, index) => (
              <figure className="pj-fig" key={image.src}>
                <img
                  src={image.src}
                  alt={image.alt}
                  width={image.width}
                  height={image.height}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              </figure>
            ))}
          </div>
        </div>
      </header>

      <section className="section">
        <div className="wrap">
          {project.sections.map((section) => (
            <div className="chapter rv" key={section.label}>
              <div className="k">
                <b>{section.k}</b>
                {section.label}
              </div>
              <div>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ))}

          {project.results ? (
            <div className="results">
              {project.results.map((result) => (
                <div key={result.label}>
                  <b>{result.value}</b>
                  <span>{result.label}</span>
                </div>
              ))}
            </div>
          ) : null}

          <a className="next" href={routes.realisations}>
            <span className="lbl">Projet suivant</span>
            <b>
              {next.name} — {next.disciplines[0]}
            </b>
            <span className="lbl">↗</span>
          </a>
        </div>
      </section>

      <section className="cta-section">
        <div className="wrap">
          <div className="bandcta bandcta--dark cta-glow">
            <div className="glow" aria-hidden="true" />
            <p>Un projet, une formation, un avis ?</p>
            <a className="btn-fill btn-fill--light" href="mailto:s.sujeepan.pro@gmail.com?subject=Un%20projet">
              Prendre contact <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
