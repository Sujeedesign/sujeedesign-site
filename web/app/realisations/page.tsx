import type { Metadata } from "next";
import { Realisations, pageMeta } from "@/components/pages/Realisations";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";

export const metadata: Metadata = pageMetadata(pageMeta, routes.realisations, "/assets/img/og/realisations.jpg");

export default function Page() {
  return (
    <PageShell current={routes.realisations}>
      <main id="main">
        <Realisations />
      </main>
    </PageShell>
  );
}
