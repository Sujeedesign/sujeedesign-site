import { CallToAction, Cases, Hero, Method, Services, Studio } from "@/components/home/Home";
import { JsonLd } from "@/components/site/JsonLd";
import { ReadRail, SiteFooter, SiteNav, SkipLink, SocialRail } from "@/components/site/Chrome";
import { site } from "@/content/site";
import { getHomeContent } from "@/lib/content/live";
import { routes } from "@/lib/routes";
import { pageGraph, webPageNode } from "@/lib/structured-data";

// Le contenu vient de la base, mise en cache sous le tag `content` : publier
// dans l'admin invalide ce tag et la page se régénère, sans rebuild Docker.
export const revalidate = 3600;

export default async function HomePage() {
  const doc = await getHomeContent();
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
        <Hero doc={doc} />
        <Studio doc={doc} />
        <Cases doc={doc} />
        <Method doc={doc} />
        <Services doc={doc} />
        <CallToAction doc={doc} />
      </main>
      <SiteFooter />
    </>
  );
}
