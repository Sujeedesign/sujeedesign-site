import type { Metadata } from "next";
import { MentionsLegales, pageMeta } from "@/components/pages/MentionsLegales";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";

export const metadata: Metadata = pageMetadata(pageMeta, routes.mentionsLegales, "/assets/img/og/mentions-legales.jpg");

export default function Page() {
  return (
    <PageShell current={routes.mentionsLegales}>
      <main id="main">
        <MentionsLegales />
      </main>
    </PageShell>
  );
}
