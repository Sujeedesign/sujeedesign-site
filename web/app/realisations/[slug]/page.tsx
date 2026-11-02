import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjetCase, projectMeta } from "@/components/pages/ProjetCase";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { linkedServices } from "@/lib/project-links";
import { realisationPath, routes } from "@/lib/routes";
import { breadcrumbNode, creativeWorkNode, pageGraph, webPageNode } from "@/lib/structured-data";
import { projectSlugs } from "@/content/projects";
import { findProject, getProjects } from "@/lib/content/catalogue";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projectSlugs.map((slug) => ({ slug }));
}

// Les fiches publiées depuis l'admin après le build sont rendues à la demande,
// puis mises en cache sous le tag `catalogue`.
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = findProject(await getProjects(), slug);
  if (!project) return {};
  return pageMetadata(
    projectMeta(project),
    realisationPath(slug),
    `/assets/img/og/${slug}.jpg`,
  );
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const projects = await getProjects();
  const project = findProject(projects, slug);
  if (!project) notFound();

  return (
    <PageShell current={routes.realisations}>
      <JsonLd
        data={pageGraph([
          webPageNode(realisationPath(slug), project.name, project.pitch),
          creativeWorkNode(project),
          // Les prestations affichées en bas de fiche sont aussi décrites ici :
          // le `CreativeWork` et le `Service` partagent le même `@graph`.
          ...linkedServices(project).map((service) => service.node),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Réalisations", path: routes.realisations },
            { name: project.name, path: realisationPath(slug) },
          ]),
        ])}
      />
      <main id="main">
        <ProjetCase project={project} projects={projects} />
      </main>
    </PageShell>
  );
}
