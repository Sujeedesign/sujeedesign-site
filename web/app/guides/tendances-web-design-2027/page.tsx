import type { Metadata } from "next";
import { GuideTendances2027, faqItems, pageMeta } from "@/components/pages/GuideTendances2027";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import {
  articleNode,
  breadcrumbNode,
  faqNode,
  pageGraph,
  webPageNode,
} from "@/lib/structured-data";

const PATH = routes.guideTendances2027;

export const metadata: Metadata = pageMetadata(
  pageMeta,
  PATH,
  "/assets/img/og/tendances-2027.jpg",
);

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, pageMeta.title, pageMeta.description),
          articleNode(
            PATH,
            pageMeta.title,
            pageMeta.description,
            "2026-12-12T09:00:00+01:00",
            "2026-12-12T09:00:00+01:00",
          ),
          faqNode(PATH, faqItems),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Tendances web design 2027", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <GuideTendances2027 />
      </main>
    </PageShell>
  );
}
