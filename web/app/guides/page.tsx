import type { Metadata } from "next";
import { GuidesHub, pageMeta } from "@/components/pages/GuidesHub";
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

const PATH = routes.guides;

export const metadata: Metadata = pageMetadata(pageMeta, PATH);

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, pageMeta.title, pageMeta.description),
          itemListNode(PATH, "Guides du studio", [
            { name: "Combien coûte un logo en 2026 ?", path: routes.guidePrixLogo },
            { name: "Combien coûte un site internet ?", path: routes.guidePrixSite },
            { name: "Agence ou freelance, comment choisir", path: routes.guideAgenceFreelance },
            { name: "Tendances web design 2027", path: routes.guideTendances2027 },
            { name: "Réussir l'examen VTC 2027", path: routes.vtc },
          ]),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Guides", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <GuidesHub />
      </main>
    </PageShell>
  );
}
