import type { Metadata } from "next";
import { AgentsIa, pageMeta } from "@/components/pages/AgentsIa";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, serviceNode, webPageNode } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata(pageMeta, routes.agentsIa, "/assets/img/og/agents-ia.jpg");

export default function Page() {
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
        <AgentsIa />
      </main>
    </PageShell>
  );
}
