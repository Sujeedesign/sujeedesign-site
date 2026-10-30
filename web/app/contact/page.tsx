import type { Metadata } from "next";
import ContactChat from "@/components/pages/ContactChat";
import { JsonLd } from "@/components/site/JsonLd";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";
import { breadcrumbNode, pageGraph, webPageNode } from "@/lib/structured-data";

const pageMeta = {
  title: "Contact : parlons de votre projet",
  description:
    "Décrivez votre projet à l'assistant de Sujee Design : cadrage immédiat, fourchette budgétaire et créneau d'appel de 30 minutes. Réponse sous 24 h ouvrées.",
};

export const metadata: Metadata = pageMetadata(pageMeta, routes.contact, "/assets/img/og/contact.jpg");

export default function Page() {
  return (
    <PageShell current={routes.contact}>
      <JsonLd
        data={pageGraph([
          webPageNode(routes.contact, pageMeta.title, pageMeta.description),
          breadcrumbNode([
            { name: "Accueil", path: routes.home },
            { name: "Contact", path: routes.contact },
          ]),
        ])}
      />
      <main id="main">
        <div className="wrap">
          <ContactChat />
        </div>
      </main>
    </PageShell>
  );
}
