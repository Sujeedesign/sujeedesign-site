import type { Metadata } from "next";
import { GuidePrixSite, aeo, faqItems, pageMeta } from "@/components/pages/GuidePrixSite";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { FloatingCta } from "@/components/site/FloatingCta";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import {
  articleNode,
  breadcrumbNode,
  faqNode,
  pageGraph,
  webPageNode,
} from "@/lib/structured-data";

const PATH = routes.guidePrixSite;

export const metadata: Metadata = pageMetadata(
  pageMeta,
  PATH,
  "/assets/img/og/site-ecommerce.jpg",
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
            "2026-11-10T09:00:00+01:00",
            "2026-11-10T09:00:00+01:00",
          ),
          // La réponse « En bref » est visible en haut de page : elle entre en tête du FAQPage.
          faqNode(PATH, [aeo, ...faqItems]),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Prix d'un site", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <GuidePrixSite />
      </main>

      <FloatingCta
        sujet="Guide · Prix d'un site"
        titre="Un site au bon périmètre"
        texte="Le prix dépend du contenu, des fonctionnalités et du suivi. On définit ensemble ce qui est indispensable, et ce qui peut attendre."
        libelle="Cadrer mon site"
        projet="site"
      />
    </PageShell>
  );
}
