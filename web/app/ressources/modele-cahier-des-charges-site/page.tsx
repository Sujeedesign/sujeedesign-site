import type { Metadata } from "next";
import {
  ModeleCahierDesCharges,
  aeo,
  faqItems,
  pageMeta,
} from "@/components/pages/ModeleCahierDesCharges";
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

const PATH = routes.modeleCahierDesCharges;

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
            "2026-11-11T10:00:00+01:00",
            "2026-11-11T10:00:00+01:00",
          ),
          // L'« En bref » est visible en haut de page : il ouvre le FAQPage.
          faqNode(PATH, [aeo, ...faqItems]),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Cahier des charges", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <ModeleCahierDesCharges />
      </main>

      <FloatingCta
        sujet="Ressource · Cahier des charges"
        titre="Le document est rempli, passons au site"
        texte="Un cahier des charges clair, c'est déjà la moitié du projet. On cadre le périmètre, le budget et le calendrier de votre site."
        libelle="Cadrer mon site"
        projet="site"
      />
    </PageShell>
  );
}
