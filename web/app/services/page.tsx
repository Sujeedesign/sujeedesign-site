import type { Metadata } from "next";
import { Services, pageMeta } from "@/components/pages/Services";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";

export const metadata: Metadata = pageMetadata(pageMeta, routes.services, "/assets/img/og/services.jpg");

export default function Page() {
  return (
    <PageShell current={routes.services}>
      <main id="main">
        <Services />
      </main>
    </PageShell>
  );
}
