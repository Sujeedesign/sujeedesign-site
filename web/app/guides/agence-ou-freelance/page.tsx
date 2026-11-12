import type { Metadata } from "next";
import {
  GuideAgenceFreelance,
  aeo,
  faqItems,
  pageMeta,
} from "@/components/pages/GuideAgenceFreelance";
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

const PATH = routes.guideAgenceFreelance;

export const metadata: Metadata = pageMetadata(
  pageMeta,
  PATH,
  "/assets/img/og/identite-de-marque.jpg",
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
            "2026-11-12T09:00:00+01:00",
            "2026-11-12T09:00:00+01:00",
          ),
          // La réponse « En bref » est visible en haut de page : elle entre en tête du FAQPage.
          faqNode(PATH, [aeo, ...faqItems]),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Agence ou freelance", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <GuideAgenceFreelance />
      </main>

      <FloatingCta
        sujet="Guide · Agence ou freelance"
        titre="Le bon format de projet"
        texte="Selon le périmètre, un studio indépendant suffit ou une équipe devient nécessaire. On tranche ensemble, avec le budget en face."
        libelle="Cadrer mon projet"
        projet="identite"
      />
    </PageShell>
  );
}
