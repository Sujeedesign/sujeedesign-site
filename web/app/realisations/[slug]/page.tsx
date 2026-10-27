import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Projet, pageMeta } from "@/components/pages/Projet";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";

/** Le v5 ne publie qu'une étude de cas ; toute autre valeur renvoie un 404. */
const projects = ["vaasam"] as const;

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return projects.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  if (!projects.includes(slug as (typeof projects)[number])) return {};
  return pageMetadata(pageMeta, `${routes.realisations}/${slug}`);
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  if (!projects.includes(slug as (typeof projects)[number])) notFound();

  return (
    <PageShell current={routes.realisations}>
      <main id="main">
        <Projet />
      </main>
    </PageShell>
  );
}
