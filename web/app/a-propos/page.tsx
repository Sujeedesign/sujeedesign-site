import type { Metadata } from "next";
import { APropos, pageMeta } from "@/components/pages/APropos";
import { PageShell } from "@/components/site/PageShell";
import { pageMetadata } from "@/lib/page-metadata";
import { routes } from "@/lib/routes";

export const metadata: Metadata = pageMetadata(pageMeta, routes.aPropos, "/assets/img/og/a-propos.jpg");

export default function Page() {
  return (
    <PageShell current={routes.aPropos}>
      <main id="main">
        <APropos />
      </main>
    </PageShell>
  );
}
