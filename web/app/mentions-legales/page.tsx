import type { Metadata } from "next";
import { MentionsLegales, pageMeta } from "@/components/pages/MentionsLegales";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, webPageNode } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata(pageMeta, routes.mentionsLegales, "/assets/img/og/mentions-legales.jpg");

export default function Page() {
  return (
    <PageShell current={routes.mentionsLegales}>
      <JsonLd
        data={pageGraph([
          webPageNode(routes.mentionsLegales, pageMeta.title, pageMeta.description),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Mentions légales", path: routes.mentionsLegales },
          ]),
        ])}
      />
      <main id="main">
        <MentionsLegales />
      </main>
    </PageShell>
  );
}
