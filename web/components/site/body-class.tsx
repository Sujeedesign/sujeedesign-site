"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Le v5 pose `has-dark-hero` sur `<body>` pour la seule page d'accueil.
 *
 * La classe est appliquée avant le premier rendu par un script inline dans le layout, puis
 * maintenue ici lors des navigations côté client.
 */
export function BodyClass() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.toggle("has-dark-hero", pathname === "/");
  }, [pathname]);

  return null;
}

/** Script bloquant placé en tête de `<body>` : évite un flash de fond clair. */
export const bodyClassScript = `if(location.pathname==="/"){document.body.classList.add("has-dark-hero")}`;
