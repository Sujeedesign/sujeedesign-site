import { coverOf, type Project } from "@/content/projects";
import { projectVideos } from "@/content/videos";
import { CoverPicture } from "@/components/CoverPicture";
import { nextProjectIn } from "@/lib/content/catalogue";
import { linkedServices, relatedProjects } from "@/lib/project-links";
import { realisationPath, routes } from "@/lib/routes";

/** Métadonnées d'une étude de cas, dérivées de sa fiche. */
export function projectMeta(project: Project): { title: string; description: string } {
  const year = project.year && !project.name.includes(project.year) ? ` (${project.year})` : "";
  return {
    title: `${project.name}${year} — ${project.disciplines[0] ?? ""}`.trim(),
    description: project.pitch,
  };
}

export function ProjetCase({ project, projects }: { project: Project; projects: Project[] }) {
  const next = nextProjectIn(projects, project.slug) ?? project;
  // Maillage interne : services déduits des disciplines, puis deux fiches voisines.
  const services = linkedServices(project);
  const related = relatedProjects(project, 2, projects);
  const videos = projectVideos[project.slug] ?? [];
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

      {videos.length ? (
        <section className="section pj-films" aria-labelledby="films-titre">
          <div className="wrap">
            <div className="chapter">
              <div className="k">
                <b>Films</b>
                Les deux animations
              </div>
              <div>
                <h2 id="films-titre">Les vœux, en mouvement</h2>
                <p>Les deux films diffusés pour les vœux 2018, dans leur montage final.</p>
                <div className="pj-film-list">
                  {videos.map((video) => (
                    <figure className="pj-film" key={video.src}>
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        poster={video.poster}
                        width={video.width}
                        height={video.height}
                        aria-label={`${video.title} — ${video.caption}`}
                      >
                        <source src={video.src} type="video/mp4" />
                        Votre navigateur ne peut pas lire cette vidéo.{" "}
                        <a href={video.src}>Télécharger le film</a>.
                      </video>
                      <figcaption>
                        <b>{video.title}</b> — {video.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

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

          {services.length ? (
            <div className="pjx">
              <div className="pjx__head">
                <h2>Prestations mobilisées</h2>
                <span>Services</span>
              </div>
              <div className="pjx__links">
                {services.map((service) => (
                  <a className="pjx__link" href={service.href} key={service.slug}>
                    {service.name} <span aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          {related.length ? (
            <div className="pjx">
              <div className="pjx__head">
                <h2>Projets liés</h2>
                <span>Réalisations</span>
              </div>
              <div className="pjx__cases">
                {related.map((entry) => (
                  <a
                    className="case c-paper case--photo pjx__case"
                    href={realisationPath(entry.slug)}
                    key={entry.slug}
                  >
                    {coverOf(entry) ? (
                      <span className="case__bg" aria-hidden="true">
                        <CoverPicture project={entry} alt="" loading="lazy" />
                      </span>
                    ) : null}
                    <div className="case__top">
                      <span className="case__idx">
                        {entry.index} / {entry.disciplines.join(" · ")}
                      </span>
                      <span className="case__meta">
                        {entry.client}
                        {entry.year ? ` ${entry.year}` : ""}
                      </span>
                    </div>
                    <div className="case__body" />
                    <div className="case__foot">
                      <div className="case__text">
                        <h3 className="case__title">{entry.name}</h3>
                        <ul className="case__sub">
                          {entry.disciplines.map((d) => (
                            <li key={d}>{d}</li>
                          ))}
                        </ul>
                      </div>
                      <span className="case__cta">
                        Voir l’étude de cas <span aria-hidden="true">↗</span>
                      </span>
                    </div>
                    <span className="case__ghost" aria-hidden="true">
                      {entry.index}
                    </span>
                  </a>
                ))}
              </div>
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
            <a className="btn-fill btn-fill--light" href={routes.contact}>
              Prendre contact <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}