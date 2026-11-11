"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./FloatingCta.module.css";

export type ProjetCta = "logo" | "identite" | "site";

export type FloatingCtaProps = {
  /** Thématique affichée en surtitre, ex. « Guide · Prix du logo ». */
  sujet: string;
  titre: string;
  texte: string;
  /** Libellé du bouton principal. */
  libelle: string;
  projet: ProjetCta;
};

const CLE_FERME = "sjd-cta-ferme";

export function FloatingCta({ sujet, titre, texte, libelle, projet }: FloatingCtaProps) {
  const [visible, setVisible] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [ferme, setFerme] = useState(false);
  const boutonRef = useRef<HTMLButtonElement | null>(null);

  // Fermeture mémorisée pour la session en cours.
  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLE_FERME) === "1") setFerme(true);
    } catch {
      /* mode privé : pas bloquant */
    }
  }, []);

  // Apparition après un premier défilement : on ne masque pas l'arrivée sur la page.
  useEffect(() => {
    if (ferme) return;
    const surScroll = () => setVisible(window.scrollY > 380);
    surScroll();
    window.addEventListener("scroll", surScroll, { passive: true });
    return () => window.removeEventListener("scroll", surScroll);
  }, [ferme]);

  // Échap referme la carte et rend le focus à la pastille.
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOuvert(false);
      boutonRef.current?.focus();
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [ouvert]);

  if (ferme) return null;

  const fermerPourSession = () => {
    setFerme(true);
    try {
      sessionStorage.setItem(CLE_FERME, "1");
    } catch {
      /* mode privé : pas bloquant */
    }
  };

  return (
    <div className={`${styles.root} ${visible ? styles.visible : ""}`}>
      {ouvert ? (
        <div className={styles.card} role="dialog" aria-label={titre}>
          <button
            type="button"
            className={styles.fermer}
            onClick={fermerPourSession}
            aria-label="Fermer cet appel à l'action pour toute la session"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.4" fill="none" />
            </svg>
          </button>
          <p className={styles.sujet}>{sujet}</p>
          <p className={styles.titre}>{titre}</p>
          <p className={styles.texte}>{texte}</p>
          <div className={styles.actions}>
            <Link className="btn-fill btn-fill--light" href={`/contact?projet=${projet}`}>
              {libelle}
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                <path d="M2 10L10 2M4 2h6v6" stroke="currentColor" strokeWidth="1.4" fill="none" />
              </svg>
            </Link>
          </div>
        </div>
      ) : (
        <button
          ref={boutonRef}
          type="button"
          className={styles.pill}
          onClick={() => setOuvert(true)}
        >
          <span className={styles.dot} aria-hidden="true" />
          Créer mon projet
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path d="M6 2v8M2 6l4-4 4 4" stroke="currentColor" strokeWidth="1.4" fill="none" />
          </svg>
        </button>
      )}
    </div>
  );
}
