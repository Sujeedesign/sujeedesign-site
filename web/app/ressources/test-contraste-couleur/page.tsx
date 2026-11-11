import type { Metadata } from "next";
import { TestContraste, faqItems, pageMeta } from "@/components/pages/TestContraste";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { FloatingCta } from "@/components/site/FloatingCta";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import {
  breadcrumbNode,
  faqNode,
  pageGraph,
  webApplicationNode,
  webPageNode,
} from "@/lib/structured-data";

const PATH = routes.testContraste;

export const metadata: Metadata = pageMetadata(pageMeta, PATH);

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, pageMeta.title, pageMeta.description),
          {
            ...webApplicationNode(PATH, pageMeta.title, pageMeta.description, "DesignApplication"),
            featureList: [
              "Rapport de contraste WCAG 2.2 entre deux couleurs",
              "Seuils AA et AAA pour texte normal, grand texte et composants",
              "Simulation de protanopie, deutéranopie, tritanopie et achromatopsie",
              "Correctif proposé en conservant la teinte d'origine",
            ],
          },
          faqNode(PATH, faqItems),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Test de contraste", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <TestContraste />
      </main>

      <FloatingCta
        sujet="Ressource · Contraste"
        titre="Une charte qui tient à l'écran"
        texte="Le contraste se règle au moment de la charte, pas après la mise en ligne. On peut vérifier et corriger vos couleurs existantes."
        libelle="Parler de ma charte"
        projet="identite"
      />
    </PageShell>
  );
}
