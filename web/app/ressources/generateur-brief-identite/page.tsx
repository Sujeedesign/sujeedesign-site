import type { Metadata } from "next";
import { GenerateurBrief, faqItems, pageMeta } from "@/components/pages/GenerateurBrief";
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

const PATH = routes.generateurBriefIdentite;

export const metadata: Metadata = pageMetadata(pageMeta, PATH);

export default function Page() {
  return (
    <PageShell current={PATH}>
      <JsonLd
        data={pageGraph([
          webPageNode(PATH, pageMeta.title, pageMeta.description),
          webApplicationNode(PATH, pageMeta.title, pageMeta.description),
          faqNode(PATH, faqItems),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Générateur de brief identité", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <GenerateurBrief />
      </main>

      <FloatingCta
        sujet="Ressource · Brief d'identité"
        titre="Du brief rempli à l'identité livrée"
        texte="Votre brief est prêt. On le relit ensemble et on le transforme en direction artistique, puis en fichiers utilisables."
        libelle="Créer mon identité"
        projet="identite"
      />
    </PageShell>
  );
}
