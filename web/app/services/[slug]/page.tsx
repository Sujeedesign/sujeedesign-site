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
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { getServiceContent, servicePageSlugs, type ServicePageSlug } from "@/lib/content/live";
import { pageMetadata } from "@/lib/page-metadata";
import { routes, serviceHref, servicePath, serviceSlugs, type ServiceSlug } from "@/lib/routes";
import { breadcrumbNode, pageGraph, serviceCatalog, serviceNode, webPageNode } from "@/lib/structured-data";

/**
 * Les pages service du v5, une par slug.
 *
 * `agents-ia` n'a pas de page sous `/services` : l'offre vit à la racine, on redirige
 * définitivement pour ne pas dupliquer le contenu.
 */
const services: Record<string, { Component: (props: { doc: Record<string, any> }) => React.JSX.Element; meta: { title: string; description: string } }> = {
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

/**
 * Les slugs connus sont prérendus (`generateStaticParams`), mais les autres ne
 * doivent pas produire un `NoFallbackError` au runtime : le `notFound()` plus bas
 * suffit à renvoyer une 404 propre. Laisser `dynamicParams = false` rendait les
 * quatre fiches inaccessibles en production dès que l'artefact prérendu manquait
 * dans l'image (édition en place, ISR), alors qu'elles fonctionnaient en local.
 */
export const dynamicParams = true;

/** Les fiches service se rafraîchissent pour refléter les éditions du back office. */
export const revalidate = 60;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const entry = services[slug];
  if (!entry) return {};
  return pageMetadata(
    entry.meta,
    servicePath(slug as ServiceSlug),
    `/assets/img/og/${slug}.jpg`,
  );
}

export default async function Page({ params }: Params) {
  const { slug } = await params;

  if (slug === "agents-ia") permanentRedirect(routes.agentsIa);

  const entry = services[slug];
  if (!entry) notFound();

  const { Component, meta } = entry;
  const doc = servicePageSlugs.includes(slug as ServicePageSlug)
    ? await getServiceContent(slug as ServicePageSlug)
    : {};

  return (
    <PageShell current={serviceHref(slug as ServiceSlug)}>
      <JsonLd
        data={pageGraph([
          webPageNode(servicePath(slug as ServiceSlug), meta.title, meta.description),
          serviceNode(slug as ServiceSlug, meta.description),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Services", path: routes.services },
            { name: serviceCatalog[slug as ServiceSlug].name, path: servicePath(slug as ServiceSlug) },
          ]),
        ])}
      />
      <main id="main">
        <Component doc={doc} />
      </main>
    </PageShell>
  );
}
