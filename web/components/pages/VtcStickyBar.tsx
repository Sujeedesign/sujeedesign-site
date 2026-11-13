"use client";

import { useEffect, useState } from "react";
import styles from "@/app/reussir-examen-vtc/vtc.module.css";

type Props = {
  memoUrl: string;
  guideUrl: string;
};

/* Barre d'action mobile : n'apparaît qu'une fois le hero dépassé,
   pour ne pas recouvrir les boutons et la couverture du guide. */
export default function VtcStickyBar({ memoUrl, guideUrl }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const seuil = window.innerHeight * 1.15;
      setVisible(window.scrollY > seuil);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`${styles.stickyBar} ${visible ? styles.stickyBarOn : ""}`}
      aria-label="Actions rapides"
      aria-hidden={!visible}
    >
      <a className={styles.stickyGhost} href={memoUrl} target="_blank" rel="noopener">
        PDF gratuit
      </a>
      <a className={styles.stickySolid} href={guideUrl} target="_blank" rel="noopener">
        Le guide · 19,90 €
      </a>
    </div>
  );
}
