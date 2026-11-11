import type { Metadata } from "next";
import { CalculateurBudget, faqItems, pageMeta } from "@/components/pages/CalculateurBudget";
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

const PATH = routes.calculateurBudgetIdentite;

export const metadata: Metadata = pageMetadata(pageMeta, PATH, "/assets/img/og/identite-de-marque.jpg");

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, pageMeta.title, pageMeta.description),
          webApplicationNode(PATH, "Calculateur de budget identité visuelle", pageMeta.description),
          faqNode(PATH, faqItems),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Calculateur de budget identité", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <CalculateurBudget />
      </main>

      <FloatingCta
        sujet="Ressource · Budget identité"
        titre="Votre budget identité, au réel"
        texte="Le calculateur donne un ordre de grandeur. Un devis, lui, tient compte de votre marché, de vos supports et de votre calendrier."
        libelle="Parler de mon identité"
        projet="identite"
      />
    </PageShell>
  );
}
