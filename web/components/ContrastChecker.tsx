"use client";

/**
 * Vérificateur de contraste.
 *
 * Aucun calcul côté serveur : tout se fait dans le navigateur, aucune couleur
 * n'est envoyée. Le composant ne fait que rendre les fonctions pures de
 * `lib/contrast.ts`, testées séparément.
 */
import { useMemo, useState } from "react";
import {
  contrast,
  fixForeground,
  parseHex,
  readableOn,
  simulate,
  toHex,
  verdict,
  VISIONS,
  WCAG,
  type Rgb,
} from "@/lib/contrast";
import styles from "./ContrastChecker.module.css";

type Slot = "text" | "bg";

const DEFAULTS: Record<Slot, string> = { text: "#5c5c5e", bg: "#f7f7f5" };

function safeHex(value: string, fallback: string): string {
  const rgb = parseHex(value);
  return rgb ? toHex(rgb) : fallback;
}

export function ContrastChecker() {
  const [text, setText] = useState(DEFAULTS.text);
  const [bg, setBg] = useState(DEFAULTS.bg);
  const [vision, setVision] = useState<(typeof VISIONS)[number]["id"] | null>(null);

  const rgbText = useMemo(() => parseHex(text), [text]);
  const rgbBg = useMemo(() => parseHex(bg), [bg]);

  const ratio = rgbText && rgbBg ? contrast(rgbText, rgbBg) : 0;
  const v = verdict(ratio);
  const fixed = rgbText && rgbBg ? toHex(fixForeground(rgbText, rgbBg)) : null;
  const shown = ratio.toFixed(2).replace(".", ",");

  const display = (slot: Slot): { rgb: Rgb; hex: string } | null => {
    const base = slot === "text" ? rgbText : rgbBg;
    if (!base) return null;
    const simulated = vision ? simulate(base, vision) : base;
    return { rgb: simulated, hex: toHex(simulated) };
  };

  const textShown = display("text");
  const bgShown = display("bg");

  const setSlot = (slot: Slot, value: string) => {
    if (slot === "text") setText(value);
    else setBg(value);
  };

  const swap = () => {
    setText(bg);
    setBg(text);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.fields}>
          {(["text", "bg"] as Slot[]).map((slot) => {
            const value = slot === "text" ? text : bg;
            const valid = Boolean(parseHex(value));
            return (
              <div className={styles.field} key={slot}>
                <label className={styles.label} htmlFor={`contraste-${slot}`}>
                  {slot === "text" ? "Couleur du texte" : "Couleur de fond"}
                </label>
                <div className={styles.inputRow}>
                  <input
                    id={`contraste-${slot}`}
                    className={styles.swatch}
                    type="color"
                    value={safeHex(value, DEFAULTS[slot])}
                    onChange={(event) => setSlot(slot, event.target.value)}
                    aria-label={slot === "text" ? "Choisir la couleur du texte" : "Choisir la couleur de fond"}
                  />
                  <input
                    className={styles.hex}
                    type="text"
                    value={value}
                    onChange={(event) => setSlot(slot, event.target.value)}
                    spellCheck={false}
                    autoComplete="off"
                    aria-invalid={!valid}
                    inputMode="text"
                  />
                </div>
                {!valid ? <p className={styles.error}>Code hexadécimal attendu, par exemple #1a1a1a.</p> : null}
              </div>
            );
          })}
          <button type="button" className={styles.swap} onClick={swap}>
            Inverser texte et fond
          </button>
        </div>

        <div className={styles.result} aria-live="polite">
          <p className={styles.ratio}>
            {shown}
            <span>: 1</span>
          </p>
          <p className={styles.ratioNote}>
            {ratio >= WCAG.aaaNormal
              ? "Contraste AAA : confortable même en petit texte."
              : ratio >= WCAG.aaNormal
                ? "Contraste AA : conforme pour du texte courant."
                : ratio >= WCAG.aaaLarge
                  ? "Réservé au grand texte : gras 18,66 px ou 24 px."
                  : "Sous les seuils : à réserver aux éléments décoratifs."}
          </p>
          <ul className={styles.checks}>
            <li data-ok={v.aaNormal}>AA texte normal, 4,5:1</li>
            <li data-ok={v.aaLarge}>AA grand texte, 3:1</li>
            <li data-ok={v.aaaNormal}>AAA texte normal, 7:1</li>
            <li data-ok={v.aaaLarge}>AAA grand texte, 4,5:1</li>
          </ul>
        </div>
      </div>

      {textShown && bgShown ? (
        <div className={styles.preview} style={{ background: bgShown.hex, color: textShown.hex }}>
          <p className={styles.previewBig}>Votre marque, de A à Z</p>
          <p className={styles.previewMid}>
            Un titre de section à 24 px doit rester lisible sans effort, même sur un écran de téléphone
            en plein soleil.
          </p>
          <p className={styles.previewSmall}>
            Texte courant à 16 px : c&apos;est la taille de la majorité des paragraphes, et celle qui
            échoue le plus souvent quand on choisit un gris trop clair.
          </p>
        </div>
      ) : null}

      <div className={styles.visions}>
        <p className={styles.visionsLabel}>Voir la paire comme</p>
        <div className={styles.chips}>
          <button
            type="button"
            className={styles.chip}
            data-active={vision === null}
            onClick={() => setVision(null)}
          >
            Vision standard
          </button>
          {VISIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.chip}
              data-active={vision === item.id}
              onClick={() => setVision(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {vision ? (
          <p className={styles.visionsNote}>
            Simulation d&apos;affichage, pas une mesure clinique. Elle sert à repérer une paire qui
            s&apos;effondre quand les couleurs se rapprochent.
          </p>
        ) : null}
      </div>

      {fixed && rgbText && rgbBg && fixed !== toHex(rgbText) && ratio < WCAG.aaNormal ? (
        <div className={styles.fix}>
          <p>
            Le texte actuel n&apos;atteint pas 4,5:1. En gardant la teinte, ce ton passe :{" "}
            <strong>{fixed}</strong>.
          </p>
          <button type="button" className={styles.fixButton} onClick={() => setText(fixed)}>
            Appliquer {fixed}
          </button>
        </div>
      ) : null}

      <p className={styles.privacy}>
        Tout le calcul se fait dans votre navigateur. Aucune couleur, aucun texte n&apos;est envoyé à un
        serveur.
      </p>
    </div>
  );
}
