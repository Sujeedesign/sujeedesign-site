"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./GuideTendances2027.module.css";

type Props = {
  src: string;
  webm: string;
  poster: string;
  width: number;
  height: number;
  alt: string;
  caption: ReactNode;
};

/**
 * Clip court d'un site, joué uniquement quand la figure est visible et jamais
 * si la personne a demandé moins d'animation. `preload="none"` garde la page
 * légère : rien n'est téléchargé avant l'entrée dans le viewport.
 */
export function GuideVideo({ src, webm, poster, width, height, alt, caption }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (reduced) {
      video.pause();
      return;
    }
    if (typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void video.play().catch(() => {});
          } else {
            video.pause();
          }
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <figure className={styles.figure}>
      <div className={styles.videoWrap}>
        <video
          ref={videoRef}
          className={styles.video}
          poster={poster}
          width={width}
          height={height}
          muted
          loop
          playsInline
          preload="none"
          aria-label={alt}
        >
          <source src={webm} type="video/webm" />
          <source src={src} type="video/mp4" />
        </video>
        {reduced ? (
          <button
            type="button"
            className={styles.videoPlay}
            onClick={() => {
              const video = videoRef.current;
              if (!video) return;
              void video.play().catch(() => {});
              setReduced(false);
            }}
          >
            Lire la séquence
          </button>
        ) : null}
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
