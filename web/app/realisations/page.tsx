import type { Metadata } from "next";
import { Realisations, pageMeta } from "@/components/pages/Realisations";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, webPageNode } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata(pageMeta, routes.realisations, "/assets/img/og/realisations.jpg");

export default function Page() {
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
        <Realisations />
      </main>
    </PageShell>
  );
}
