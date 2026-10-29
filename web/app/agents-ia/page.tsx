import type { Metadata } from "next";
import { AgentsIa, pageMeta } from "@/components/pages/AgentsIa";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { getPageContent } from "@/lib/content/live";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, serviceNode, webPageNode } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata(pageMeta, routes.agentsIa, "/assets/img/og/agents-ia.jpg");

export const revalidate = 3600;

export default async function Page() {
  const doc = await getPageContent("agents-ia");
  return (
    <PageShell current={routes.agentsIa}>
      <JsonLd
        data={pageGraph([
          webPageNode(routes.agentsIa, pageMeta.title, pageMeta.description),
          serviceNode("agents-ia", pageMeta.description),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Agents IA", path: routes.agentsIa },
          ]),
        ])}
      />
      <main id="main">
        <AgentsIa doc={doc} />
      </main>
    </PageShell>
  );
}
