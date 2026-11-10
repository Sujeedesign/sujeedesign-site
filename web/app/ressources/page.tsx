import type { Metadata } from "next";
import { RessourcesHub, pageMeta } from "@/components/pages/RessourcesHub";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import {
  breadcrumbNode,
  itemListNode,
  pageGraph,
  webPageNode,
} from "@/lib/structured-data";

const PATH = routes.ressources;

export const metadata: Metadata = pageMetadata(pageMeta, PATH);

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, pageMeta.title, pageMeta.description),
          itemListNode(PATH, "Outils et guides de prix du studio", [
            { name: "Calculateur de budget identité visuelle", path: routes.calculateurBudgetIdentite },
            { name: "Combien coûte un logo en 2026 ?", path: routes.guidePrixLogo },
            { name: "Combien coûte un site internet en 2026 ?", path: routes.guidePrixSite },
            { name: "Tester son logo", path: routes.testerSonLogo },
            { name: "Générateur de brief identité", path: routes.generateurBriefIdentite },
            { name: "Modèle de cahier des charges de site", path: routes.modeleCahierDesCharges },
          ]),
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
