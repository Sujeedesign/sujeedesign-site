import { CallToAction, Cases, Hero, Method, Services, Studio } from "@/components/home/Home";
import { ReadRail, SiteFooter, SiteNav, SkipLink, SocialRail } from "@/components/site/Chrome";

export default function HomePage() {
  return (
    <>
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
