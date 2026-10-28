import type { Metadata } from "next";
import { APropos, pageMeta } from "@/components/pages/APropos";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, webPageNode } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata(pageMeta, routes.aPropos, "/assets/img/og/a-propos.jpg");

export default function Page() {
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
        <APropos />
      </main>
    </PageShell>
  );
}
