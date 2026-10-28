"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { CONSENT_KEY, GA_MEASUREMENT_ID } from "@/lib/analytics";

type Choice = "granted" | "denied" | null;

/**
 * Mesure d'audience Google Analytics 4, conditionnée au consentement.
 *
 * Aucun script Google n'est chargé avant un « Accepter » explicite : le choix
 * est conservé dans le navigateur et le bandeau ne réapparaît plus. Sans
 * identifiant de mesure configuré, le composant ne rend rien.
 */
export function Analytics() {
  const [choice, setChoice] = useState<Choice>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;
    const stored = window.localStorage.getItem(CONSENT_KEY);
    setChoice(stored === "granted" ? "granted" : stored === "denied" ? "denied" : null);
    setReady(true);
  }, []);

  function decide(value: "granted" | "denied") {
    window.localStorage.setItem(CONSENT_KEY, value);
    setChoice(value);
  }

  if (!GA_MEASUREMENT_ID || !ready) return null;

  return (
    <>
      {choice === "granted" ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      ) : null}

      {choice === null ? (
        <div
          id="cookie-banner"
          className="cookie-banner"
          role="dialog"
          aria-label="Mesure d'audience"
          style={{
            position: "fixed",
            right: "24px",
            bottom: "24px",
            zIndex: 9999,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "18px 24px",
            padding: "20px 22px",
            background: "#F4F1E8",
            color: "#0A0A0B",
            border: "1px solid rgba(10,10,11,.22)",
            borderRadius: "2px",
            boxShadow: "0 16px 44px rgba(10,10,11,.14)",
            fontFamily: '"Space Grotesk",system-ui,sans-serif',
            fontSize: "13.5px",
            lineHeight: 1.55,
            maxWidth: "620px",
          }}
        >
          <p style={{ flex: "1 1 280px", margin: 0 }}>
            Mesure d&apos;audience : un cookie Google Analytics pour savoir quelles pages
            servent. Aucune revente, aucun profilage publicitaire.{" "}
            <a
              href="/mentions-legales"
              style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: "3px" }}
            >
              En savoir plus
            </a>
          </p>
          <div style={{ display: "flex", gap: "10px", flex: "0 0 auto" }}>
            <button
              type="button"
              onClick={() => decide("denied")}
              style={{
                minWidth: "104px",
                padding: "11px 16px",
                background: "transparent",
                color: "#0A0A0B",
                border: "1px solid rgba(10,10,11,.42)",
                borderRadius: "2px",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => decide("granted")}
              style={{
                minWidth: "104px",
                padding: "11px 16px",
                background: "transparent",
                color: "#0A0A0B",
                border: "1px solid rgba(10,10,11,.42)",
                borderRadius: "2px",
                font: "inherit",
                cursor: "pointer",
              }}
            >
              Accepter
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
