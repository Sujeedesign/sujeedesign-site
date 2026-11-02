"use client";

import { CONSENT_KEY } from "@/lib/analytics";

/**
 * Retrait du consentement à la mesure d'audience.
 *
 * Efface le choix enregistré puis recharge la page : le bandeau réapparaît et
 * l'internaute peut refuser, comme l'exige le RGPD (retrait aussi simple que
 * l'acceptation).
 */
export function ConsentReset() {
  function reset() {
    try {
      window.localStorage.removeItem(CONSENT_KEY);
    } catch {
      /* stockage indisponible : le rechargement suffit */
    }
    window.location.reload();
  }

  return (
    <p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: 0,
          background: "none",
          border: 0,
          borderBottom: "1px solid currentColor",
          color: "inherit",
          font: "inherit",
          cursor: "pointer",
        }}
      >
        Modifier mon choix de mesure d&apos;audience
      </button>
    </p>
  );
}
