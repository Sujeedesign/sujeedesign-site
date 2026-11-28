import type { Metadata } from "next";
import { Services, pageMeta, servicesFaqEntries } from "@/components/pages/Services";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { getServicesContent } from "@/lib/content/live";
import { routes, type ServiceSlug } from "@/lib/routes";
import { breadcrumbNode, faqNode, pageGraph, serviceNode, webPageNode } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata(pageMeta, routes.services, "/assets/img/og/services.jpg");

/**
 * Le sommaire liste les quatre prestations sous `/services` (les fiches), le hub
 * lui-même vit sur `/prestations` : on décrit chacune
 * ici pour que les moteurs relient le sommaire aux pages filles. `agents-ia` vit
 * à la racine et n'est donc pas listé.
 */
const summaryServices: ServiceSlug[] = [
  "identite-de-marque",
  "direction-artistique",
  "site-ecommerce",
  "contenu-reseaux",
];

export const revalidate = 3600;

export default async function Page() {
  const doc = await getServicesContent();
  const faq = servicesFaqEntries(doc);
  return (
    <PageShell current={routes.services}>
      <JsonLd
        data={pageGraph([
          webPageNode(routes.services, pageMeta.title, pageMeta.description),
          ...summaryServices.map((slug) => serviceNode(slug)),
          // La FAQ affichée en bas de page est publiée telle quelle en
          // `FAQPage` : même source, donc aucun contenu invisible.
          ...(faq.length ? [faqNode(routes.services, faq)] : []),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Services", path: routes.services },
          ]),
        ])}
      />
      <main id="main">
        <Services doc={doc} />
      </main>
    </PageShell>
  );
}
