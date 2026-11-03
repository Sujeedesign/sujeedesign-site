import type { Metadata } from "next";
import { GenerateurBrief, faqItems, pageMeta } from "@/components/pages/GenerateurBrief";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import {
  breadcrumbNode,
  faqNode,
  pageGraph,
  webApplicationNode,
  webPageNode,
} from "@/lib/structured-data";

const PATH = routes.generateurBriefIdentite;

export const metadata: Metadata = pageMetadata(pageMeta, PATH);

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, pageMeta.title, pageMeta.description),
          webApplicationNode(PATH, pageMeta.title, pageMeta.description),
          faqNode(PATH, faqItems),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Générateur de brief identité", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <GenerateurBrief />
      </main>
    </PageShell>
  );
}
