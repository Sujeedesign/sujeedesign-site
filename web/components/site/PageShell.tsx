import type { ReactNode } from "react";
import { SiteFooter, SiteNav, SocialRail } from "./Chrome";

/**
 * Châssis commun des pages intérieures du v5.
 *
 * Ordre du DOM identique à celui des fichiers statiques : rail social,
 * navigation en version pleine (classe `solid`), contenu, pied de page secondaire.
 */
export function PageShell({ current, children }: { current?: string; children: ReactNode }) {
  return (
    <>
      <SocialRail />
      <SiteNav solid current={current} />
      {children}
      <SiteFooter />
    </>
  );
}
