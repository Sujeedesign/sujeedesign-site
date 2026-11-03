"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Réarme les apparitions au scroll après une navigation interne.
 *
 * `site.js` et `anim.js` sont chargés une seule fois par le layout : lors d'un
 * clic sur un `<Link>` Next, ils ne se réexécutent pas et les blocs `.rv` de la
 * nouvelle page restent à `opacity: 0` (page qui semble vide). Ce composant
 * observe les nouveaux `.rv` à chaque changement de route.
 */
export function RevealOnRoute() {
  const pathname = usePathname();

  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".rv:not(.in)"));
    if (!items.length) return;

    const reveal = (el: Element) => {
      el.classList.add("in");
      el.classList.add("is-in");
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(reveal);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          reveal(entry.target);
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );

    items.forEach((el) => io.observe(el));

    return () => {
      io.disconnect();
    };
  }, [pathname]);

  return null;
}
