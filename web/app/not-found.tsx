import type { Metadata } from "next";
import { ReadRail, SiteFooter, SiteNav, SkipLink, SocialRail } from "@/components/site/Chrome";
import { mailto, routes } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: false },
};

/**
 * 404 de la vitrine.
 *
 * Même châssis que les autres pages : le visiteur reste dans le site et repart par un lien utile
 * plutôt que de tomber sur une page nue.
 */
export default function NotFound() {
  return (
    <>
      <SocialRail />
      <SkipLink />
      <SiteNav />
      <ReadRail />
      <main id="main">
        <section className="section">
          <div className="wrap">
            <p className="kick">Erreur 404</p>
            <h1 className="rl-hero__title">Cette page n’existe pas.</h1>
            <p className="lead">
              Le lien est peut-être ancien, ou la page a changé d’adresse. Voici les entrées les plus
              utiles.
            </p>
            <div className="ab-hero__cta">
              <a className="btn-fill" href={routes.home}>
                Retour à l’accueil <span aria-hidden="true">↗</span>
              </a>
              <a className="btn-line" href={routes.realisations}>
                Voir les réalisations
              </a>
              <a className="btn-line" href={mailto("Un projet")}>
                Écrire un message
              </a>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
