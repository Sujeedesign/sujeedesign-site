"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InstagramFeed } from "@/lib/content/instagram";

/**
 * Section « Sur Instagram » de l'accueil : cinq vignettes choisies à la main
 * dans le back office. Le clic ouvre un player plein écran : lecture de la
 * vidéo ou affichage de l'image en grand, avec légende et lien vers le post.
 */
export function InstagramSection({ feed }: { feed: InstagramFeed }) {
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const posts = feed.posts;
  const total = posts.length;

  const close = useCallback(() => setOpen(null), []);

  const step = useCallback(
    (delta: number) => {
      setOpen((current) => {
        if (current === null) return current;
        return (current + delta + total) % total;
      });
    },
    [total],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      lastFocused.current?.focus();
    };
  }, [open, close, step]);

  const active = open === null ? null : posts[open];

  const show = (index: number) => {
    lastFocused.current = document.activeElement as HTMLElement | null;
    setOpen(index);
  };

  return (
    <section className="section ig" id="instagram">
      <div className="wrap">
        <div className="sec-head rv">
          <div className="sec-num">05</div>
          <div>
            <h2>{feed.title}</h2>
            {feed.intro ? <p>{feed.intro}</p> : null}
          </div>
          <div className="side">
            <a
              className="side__link"
              href={feed.profile}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{feed.handle}</span>
            </a>
          </div>
        </div>

        <ul className="ig__grid rv">
          {posts.map((post, index) => (
            <li key={post.id}>
              <button
                type="button"
                className="ig__tile"
                onClick={() => show(index)}
                aria-label={
                  post.kind === "video"
                    ? `Lire la vidéo${post.caption ? ` : ${post.caption}` : ""}`
                    : `Agrandir l'image${post.caption ? ` : ${post.caption}` : ""}`
                }
              >
                {post.kind === "video" ? (
                  <>
                    <video
                      className="ig__media"
                      src={post.src}
                      poster={post.poster || undefined}
                      preload="metadata"
                      muted
                      playsInline
                      aria-hidden="true"
                      tabIndex={-1}
                    />
                    <span className="ig__play" aria-hidden="true" />
                  </>
                ) : (
                  <img
                    className="ig__media"
                    src={post.src}
                    alt={post.alt || post.caption}
                    loading="lazy"
                  />
                )}
                <span className="ig__veil" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {active
        ? createPortal(
            <div
              className="ig-player"
              role="dialog"
              aria-modal="true"
              aria-label={active.caption || feed.title}
              onClick={(event) => {
                if (event.target === event.currentTarget) close();
              }}
            >
              <button
                type="button"
                className="ig-player__close"
                onClick={close}
                ref={closeRef}
                aria-label="Fermer"
              >
                <span aria-hidden="true">✕</span>
              </button>

              {total > 1 ? (
                <>
                  <button
                    type="button"
                    className="ig-player__nav ig-player__nav--prev"
                    onClick={() => step(-1)}
                    aria-label="Post précédent"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="ig-player__nav ig-player__nav--next"
                    onClick={() => step(1)}
                    aria-label="Post suivant"
                  >
                    ›
                  </button>
                </>
              ) : null}

              <figure className="ig-player__frame">
                {active.kind === "video" ? (
                  <video
                    className="ig-player__media"
                    src={active.src}
                    poster={active.poster || undefined}
                    controls
                    autoPlay
                    playsInline
                  />
                ) : (
                  <img
                    className="ig-player__media"
                    src={active.src}
                    alt={active.alt || active.caption}
                  />
                )}
                <figcaption className="ig-player__caption">
                  {active.caption ? <p>{active.caption}</p> : null}
                  {active.permalink ? (
                    <a
                      href={active.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Voir sur Instagram ↗
                    </a>
                  ) : null}
                </figcaption>
              </figure>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
