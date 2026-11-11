import type { Metadata } from "next";
import { GuidePrixLogo, aeo, faqItems, pageMeta } from "@/components/pages/GuidePrixLogo";
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

const PATH = routes.guidePrixLogo;

export const metadata: Metadata = pageMetadata(pageMeta, PATH, "/assets/img/og/identite-de-marque.jpg");

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
            "2026-11-03T09:00:00+01:00",
            "2026-11-08T09:00:00+01:00",
          ),
          // La réponse « En bref » est visible en haut de page : elle entre en tête du FAQPage.
          faqNode(PATH, [aeo, ...faqItems]),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Ressources", path: routes.ressources },
            { name: "Prix d'un logo", path: PATH },
          ]),
        ])}
      />
      <main id="main">
        <GuidePrixLogo />
      </main>

      <FloatingCta
        sujet="Guide · Prix du logo"
        titre="Votre logo, chiffré pour vous"
        texte="Le guide donne les fourchettes. Votre cas mérite un devis précis : un tarif ferme, un calendrier et des livrables définis."
        libelle="Créer mon logo"
        projet="logo"
      />
    </PageShell>
  );
}
