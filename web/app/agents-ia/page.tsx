import type { Metadata } from "next";
import { AgentsIa, pageMeta } from "@/components/pages/AgentsIa";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";

export const metadata: Metadata = pageMetadata(pageMeta, routes.agentsIa, "/assets/img/og/agents-ia.jpg");

export default function Page() {
  return (
    <PageShell current={routes.agentsIa}>
      <main id="main">
        <AgentsIa />
      </main>
    </PageShell>
  );
}
