import type { Metadata } from "next";
import { TesterLogo, faqItems, pageMeta } from "@/components/pages/TesterLogo";
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

const PATH = routes.testerSonLogo;

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
            { name: "Tester son logo", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <TesterLogo />
      </main>
    </PageShell>
  );
}
