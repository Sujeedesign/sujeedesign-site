import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ServiceIdentite, pageMeta as metaIdentite } from "@/components/pages/ServiceIdentite";
import {
  ServiceDirectionArtistique,
  pageMeta as metaDirection,
} from "@/components/pages/ServiceDirectionArtistique";
import {
  ServiceSiteEcommerce,
  pageMeta as metaEcommerce,
} from "@/components/pages/ServiceSiteEcommerce";
import { ServiceContenu, pageMeta as metaContenu } from "@/components/pages/ServiceContenu";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes, serviceHref, servicePath, serviceSlugs, type ServiceSlug } from "@/lib/routes";

/**
 * Les pages service du v5, une par slug.
 *
 * `agents-ia` n'a pas de page sous `/services` : l'offre vit à la racine, on redirige
 * définitivement pour ne pas dupliquer le contenu.
 */
const services: Record<string, { Component: () => React.JSX.Element; meta: { title: string; description: string } }> = {
  "identite-de-marque": { Component: ServiceIdentite, meta: metaIdentite },
  "direction-artistique": { Component: ServiceDirectionArtistique, meta: metaDirection },
  "site-ecommerce": { Component: ServiceSiteEcommerce, meta: metaEcommerce },
  "contenu-reseaux": { Component: ServiceContenu, meta: metaContenu },
};

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return serviceSlugs
    .filter((slug) => slug !== "agents-ia")
    .map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const entry = services[slug];
  if (!entry) return {};
  return pageMetadata(entry.meta, servicePath(slug as ServiceSlug));
}

export default async function Page({ params }: Params) {
  const { slug } = await params;

  if (slug === "agents-ia") permanentRedirect(routes.agentsIa);

  const entry = services[slug];
  if (!entry) notFound();

  const { Component } = entry;

  return (
    <PageShell current={serviceHref(slug as ServiceSlug)}>
      <main id="main">
        <Component />
      </main>
    </PageShell>
  );
}
