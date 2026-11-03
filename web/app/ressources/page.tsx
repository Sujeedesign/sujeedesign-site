import type { Metadata } from "next";
import { RessourcesHub, pageMeta } from "@/components/pages/RessourcesHub";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, webPageNode } from "@/lib/structured-data";

const PATH = routes.ressources;

export const metadata: Metadata = pageMetadata(pageMeta, PATH);

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, pageMeta.title, pageMeta.description),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <RessourcesHub />
      </main>
    </PageShell>
  );
}
