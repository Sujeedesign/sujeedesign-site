import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjetCase, projectMeta } from "@/components/pages/ProjetCase";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { realisationPath, routes } from "@/lib/routes";
import { getProject, projectSlugs } from "@/content/projects";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projectSlugs.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return pageMetadata(
    projectMeta(project),
    realisationPath(slug),
    `/assets/img/og/${slug}.jpg`,
  );
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <PageShell current={routes.realisations}>
      <main id="main">
        <ProjetCase project={project} />
      </main>
    </PageShell>
  );
}
