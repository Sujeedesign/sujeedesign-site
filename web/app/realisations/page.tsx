import type { Metadata } from "next";
import { Realisations, pageMeta } from "@/components/pages/Realisations";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { getPageContent } from "@/lib/content/live";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, webPageNode } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata(pageMeta, routes.realisations, "/assets/img/og/realisations.jpg");

export const revalidate = 3600;

export default async function Page() {
  const doc = await getPageContent("realisations");
  return (
    <PageShell current={routes.realisations}>
      <JsonLd
        data={pageGraph([
          webPageNode(routes.realisations, pageMeta.title, pageMeta.description),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Réalisations", path: routes.realisations },
          ]),
        ])}
      />
      <main id="main">
        <Realisations doc={doc} />
      </main>
    </PageShell>
  );
}
