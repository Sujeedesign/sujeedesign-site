import type { ReactNode } from "react";
import { SiteFooter, SiteNav, SkipLink, SocialRail } from "./Chrome";

/**
 * Châssis commun des pages intérieures du v5.
 *
 * Ordre du DOM identique à celui des fichiers statiques : rail social, lien d'évitement,
 * navigation en version pleine (classe `solid`), contenu, pied de page secondaire.
 */
export function PageShell({ current, children }: { current?: string; children: ReactNode }) {
  return (
    <>
      <SocialRail />
      <SkipLink />
      <SiteNav solid current={current} />
      {children}
      <SiteFooter variant="inner" />
    </>
  );
}
