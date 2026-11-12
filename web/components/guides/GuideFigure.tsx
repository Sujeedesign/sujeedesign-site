import { useId } from "react";
import styles from "./GuideFigure.module.css";

type GuideFigureProps = {
  /** Décrit le schéma pour les lecteurs d'écran : ce qu'il démontre, pas ce qu'il dessine. */
  titre: string;
  /** Légende visible, sous le schéma. */
  legende: React.ReactNode;
  viewBox: string;
  /** Consigne de défilement mobile, masquée au-delà de 700 px. */
  hint?: string;
  children: React.ReactNode;
};

/**
 * Cadre commun des illustrations de guides : panneau clair, schéma labellisé,
 * légende, consigne de défilement sur mobile et conteneur défilable accessible
 * au clavier.
 *
 * Une figure ne s'affiche que lorsqu'elle explique une décision : les pages
 * guides qui n'ont rien à démontrer n'en posent pas.
 *
 * `useId` plutôt qu'un `id` statique : deux figures identiques sur la même page
 * garderaient sinon le même `aria-labelledby` et le second schéma serait nommé
 * par le titre du premier.
 *
 * Le repli `prefers-reduced-motion` ne vit pas ici : les animations et leurs
 * états finaux dépendent des classes du module consommateur. GuideFigure se
 * contente de ne rien animer lui-même, et chaque module d'illustration éteint
 * ses propres animations en laissant le schéma dans son état final.
 */
export function GuideFigure({
  titre,
  legende,
  viewBox,
  hint = "Faites glisser pour voir la suite",
  children,
}: GuideFigureProps) {
  const titleId = useId();

  return (
    <figure className={styles.figure}>
      {/* Conteneur défilable : focusable pour que le clavier puisse le faire
          défiler, et nommé par le titre du schéma. */}
      <div className={styles.panel} role="group" tabIndex={0} aria-labelledby={titleId}>
        <svg viewBox={viewBox} role="img" aria-labelledby={titleId} className={styles.svg}>
          <title id={titleId}>{titre}</title>
          {children}
        </svg>
      </div>
      <p className={styles.hint} aria-hidden="true">
        {hint} <span aria-hidden="true">→</span>
      </p>
      <figcaption className={styles.caption}>{legende}</figcaption>
    </figure>
  );
}
