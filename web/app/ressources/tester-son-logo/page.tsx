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
          {
            ...webApplicationNode(PATH, pageMeta.title, pageMeta.description),
            featureList: [
              "Test de lisibilité à 16 pixels, en gris et en un seul ton",
              "Générateur de favicon : .ico, PNG 16 à 512 px, apple-touch-icon, icônes Android",
              "Export d'un pack favicon zippé avec site.webmanifest",
              "Analyse traitée dans le navigateur, sans téléversement du logo",
            ],
          },
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
