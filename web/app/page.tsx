import { CallToAction, Cases, Hero, Method, Services, Studio } from "@/components/home/Home";
import { JsonLd } from "@/components/site/JsonLd";
import { ReadRail, SiteFooter, SiteNav, SkipLink, SocialRail } from "@/components/site/Chrome";
import { site } from "@/content/site";
import { routes } from "@/lib/routes";
import { pageGraph, webPageNode } from "@/lib/structured-data";

export default function HomePage() {
  return (
    <>
      {/* L'image du hero est le LCP. Pas de <link rel="preload"> ici : la balise
          <img fetchPriority="high"> de Hero suffit, Next hisse déjà son preload
          dans le <head>. En ajouter un second duplique la demande. */}
      <JsonLd data={pageGraph([webPageNode(routes.home, site.name, site.tagline)])} />
      <SocialRail />
      <SkipLink />
      <SiteNav />
      <ReadRail />
      <main id="main">
        <Hero />
        <Studio />
        <Cases />
        <Method />
        <Services />
        <CallToAction />
      </main>
      <SiteFooter />
    </>
  );
}
