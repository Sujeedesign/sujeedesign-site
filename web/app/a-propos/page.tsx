import type { Metadata } from "next";
import { APropos, pageMeta } from "@/components/pages/APropos";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { getPageContent } from "@/lib/content/live";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, webPageNode } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata(pageMeta, routes.aPropos, "/assets/img/og/a-propos.jpg");

export const revalidate = 3600;

export default async function Page() {
  const doc = await getPageContent("a-propos");
  return (
    <PageShell current={routes.aPropos}>
      {/* Pas de <link rel="preload"> ici : le <img fetchPriority="high"> du portrait
          est déjà hissé dans le <head> par Next, un second lien le dupliquerait. */}
      <JsonLd
        data={pageGraph([
          webPageNode(routes.aPropos, pageMeta.title, pageMeta.description),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "À propos", path: routes.aPropos },
          ]),
        ])}
      />
      <main id="main">
        <APropos doc={doc} />
      </main>
    </PageShell>
  );
}
