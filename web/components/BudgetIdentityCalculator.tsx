"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import {
  BASES,
  OPTIONS,
  computeBudget,
  formatEuro,
  formatRange,
  type BaseId,
  type OptionId,
} from "@/lib/budget-identity";
import { routes } from "@/lib/routes";
import styles from "./BudgetIdentityCalculator.module.css";

/**
 * Calculateur de budget identité visuelle.
 *
 * Seul le calcul est côté client : les textes, le tableau des niveaux et la FAQ de la
 * page sont rendus par le serveur (exigence d'indexation). Aucune valeur ne quitte le
 * navigateur, aucun stockage, aucun cookie.
 */
export function BudgetIdentityCalculator() {
  const [base, setBase] = useState<BaseId | null>(null);
  const [options, setOptions] = useState<OptionId[]>([]);
  const [copied, setCopied] = useState(false);
  // Faux pendant le rendu serveur : évite d'afficher « choisissez un point de départ »
  // dans le HTML initial, où seul le message <noscript> a du sens.
  const [mounted, setMounted] = useState(false);

  const result = useMemo(() => computeBudget(base, options), [base, options]);

  const openedRef = useRef(false);
  const etape2Ref = useRef(false);
  const resultRef = useRef<string>("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setMounted(true);
    trackEvent("calculateur_ouvert", { page: routes.calculateurBudgetIdentite });
  }, []);

  // « Étape 2 » est franchie quand un point de départ est choisi : les options
  // deviennent alors cochables.
  useEffect(() => {
    if (base === null || etape2Ref.current) return;
    etape2Ref.current = true;
    trackEvent("calculateur_etape_2", { base });
  }, [base]);

  useEffect(() => {
    if (!result) return;
    const signature = `${result.range.low}-${result.range.high}`;
    if (signature === resultRef.current) return;
    resultRef.current = signature;
    trackEvent("calculateur_resultat", {
      fourchette: signature,
      base: result.base,
      options: result.options.length,
    });
  }, [result]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  function chooseBase(next: BaseId) {
    setBase(next);
    // Une option devenue incluse ne peut pas rester cochée.
    setCopied(false);
  }

  function toggleOption(id: OptionId, checked: boolean) {
    setOptions((current) => (checked ? [...current, id] : current.filter((item) => item !== id)));
    setCopied(false);
  }

  async function copyRecap() {
    if (!result) return;
    const text = result.recap;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const zone = document.createElement("textarea");
        zone.value = text;
        zone.setAttribute("readonly", "");
        zone.style.position = "fixed";
        zone.style.opacity = "0";
        document.body.appendChild(zone);
        zone.select();
        document.execCommand("copy");
        document.body.removeChild(zone);
      }
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  }

  const optionsLocked = base === null;

  return (
    <div className={styles.calculator}>
      <fieldset className={styles.step}>
        <legend className={styles.legend}>
          <span className={styles.stepNumber}>Étape 1</span> Où en êtes-vous ?
        </legend>
        <div className={styles.optionsList}>
          {BASES.map((item) => (
            <label key={item.id} className={styles.option}>
              <input
                type="radio"
                name="budget-base"
                value={item.id}
                checked={base === item.id}
                onChange={() => chooseBase(item.id)}
                className={styles.input}
              />
              <span className={styles.optionBody}>
                <span className={styles.optionLabel}>{item.label}</span>
                <span className={styles.optionNote}>{item.note}</span>
              </span>
              <span className={styles.optionPrice}>{formatRange(item.range)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.step}>
        <legend className={styles.legend}>
          <span className={styles.stepNumber}>Étape 2</span> De quoi avez-vous besoin en plus ?
        </legend>
        {optionsLocked ? (
          <p className={styles.hint} id="budget-options-hint">
            Choisissez d&apos;abord un point de départ à l&apos;étape 1 : les options s&apos;ajoutent à
            la base retenue.
          </p>
        ) : null}
        <div className={styles.optionsList}>
          {OPTIONS.map((item) => {
            const checked = options.includes(item.id);
            return (
              <label key={item.id} className={styles.option}>
                <input
                  type="checkbox"
                  name="budget-options"
                  value={item.id}
                  checked={checked}
                  disabled={optionsLocked}
                  onChange={(event) => toggleOption(item.id, event.currentTarget.checked)}
                  className={styles.input}
                />
                <span className={styles.optionBody}>
                  <span className={styles.optionLabel}>{item.label}</span>
                  <span className={styles.optionNote}>option</span>
                </span>
                <span className={styles.optionPrice}>+ {formatRange(item.range)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <section className={styles.step} aria-labelledby="budget-resultat">
        <h3 className={styles.legend} id="budget-resultat">
          <span className={styles.stepNumber}>Étape 3</span> Votre fourchette
        </h3>

        <div className={styles.result}>
          <div role="status" aria-live="polite" aria-atomic="true" className={styles.resultText}>
            {result ? (
              <>
                <p className={styles.total}>
                  entre <strong>{formatEuro(result.range.low)}</strong> et{" "}
                  <strong>{formatEuro(result.range.high)}</strong>
                </p>

                <ul className={styles.detail}>
                  {result.lines.map((line) => (
                    <li key={line.id} className={styles.detailLine}>
                      <span>{line.label}</span>
                      <span className={styles.detailPrice}>{formatRange(line.range)}</span>
                    </li>
                  ))}
                </ul>

                <p className={styles.top}>{topSentence(result.top)}</p>
                <p className={styles.context}>
                  Le devis final dépend des contenus que vous fournissez et du nombre
                  d&apos;allers-retours : cette fourchette situe le budget, elle ne l&apos;engage
                  pas. Les montants sont hors taxes.
                </p>
              </>
            ) : (
              <>
                <noscript>
                  <p className={styles.empty}>
                    Activez JavaScript pour lancer le calcul. Le détail des niveaux et des options
                    reste lisible plus bas.
                  </p>
                </noscript>
                {mounted ? (
                  <p className={styles.empty}>Choisissez au moins un point de départ</p>
                ) : null}
              </>
            )}
          </div>

          {result ? (
            <>
              <div className={styles.actions}>
                <Link
                  href={routes.contact}
                  className={`btn-fill ${styles.action}`}
                  onClick={() =>
                    trackEvent("calculateur_cta_contact", {
                      fourchette: `${result.range.low}-${result.range.high}`,
                    })
                  }
                >
                  Envoyer ce périmètre à Sujee
                </Link>
                <button
                  type="button"
                  className={`btn-line ${styles.action} ${styles.secondary}`}
                  onClick={copyRecap}
                >
                  Copier le récapitulatif
                </button>
              </div>
              <p className={styles.copyStatus} aria-live="polite">
                {copied ? "Récapitulatif copié dans le presse-papiers." : ""}
              </p>
            </>
          ) : null}
        </div>

        <noscript>
          <p className={styles.hint}>
            Activez JavaScript pour lancer le calcul. Les fourchettes de chaque niveau et de chaque
            option restent lisibles dans les tableaux ci-dessus.
          </p>
        </noscript>
      </section>
    </div>
  );
}

const NUMBER_WORDS: Record<number, string> = { 1: "un", 2: "deux", 3: "trois" };

/** Phrase du résumé, accordée au nombre de postes retenus. */
function topSentence(items: string[]): string {
  const list = formatList(items);
  if (items.length === 0 || !list) return "";
  if (items.length === 1) {
    return `Le poste qui pèse le plus dans ce budget : ${list}.`;
  }
  const count = NUMBER_WORDS[items.length] ?? String(items.length);
  return `Les ${count} postes qui pèsent le plus dans ce budget : ${list}.`;
}

/** « A, B et C » : énumération française, sans virgule avant « et ». */
function formatList(items: string[]): string {
  const [head, ...rest] = items;
  if (!head) return "";
  // Le premier item ouvre la phrase : majuscule initiale, le reste reste en bas de casse.
  const first = head.charAt(0).toUpperCase() + head.slice(1);
  if (rest.length === 0) return first;
  const middle = rest.slice(0, -1);
  return `${[first, ...middle].join(", ")} et ${rest[rest.length - 1]}`;
}
