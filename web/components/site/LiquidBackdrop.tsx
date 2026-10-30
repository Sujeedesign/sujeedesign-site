"use client";

import { useEffect, useRef } from "react";
import styles from "./LiquidBackdrop.module.css";

/**
 * Fond « liquide gras » : nappes de couleur lentes, voile brillant, grain.
 * Réagit très légèrement au pointeur pour que la page ne paraisse jamais figée.
 */
export function LiquidBackdrop() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const move = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const x = event.clientX / window.innerWidth - 0.5;
        const y = event.clientY / window.innerHeight - 0.5;
        node.style.setProperty("--px", `${(x * 26).toFixed(1)}px`);
        node.style.setProperty("--py", `${(y * 18).toFixed(1)}px`);
      });
    };

    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className={styles.liquid} ref={ref} aria-hidden="true">
      <span className={`${styles.blob} ${styles.blobA}`} />
      <span className={`${styles.blob} ${styles.blobB}`} />
      <span className={`${styles.blob} ${styles.blobC}`} />
      <span className={`${styles.blob} ${styles.blobD}`} />
      <span className={styles.sheen} />
      <span className={styles.grain} />
    </div>
  );
}

export default LiquidBackdrop;
