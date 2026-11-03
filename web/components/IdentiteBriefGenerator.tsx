"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BUDGETS,
  EXISTING,
  SUPPORTS,
  TRAITS,
  briefToHtml,
  briefToText,
  completeness,
  emptyBrief,
  type BriefAnswers,
  type ExistingId,
} from "@/lib/logo-brief";
import styles from "./IdentiteBriefGenerator.module.css";

type TextKey = "activity" | "pitch" | "clients" | "references" | "difference" | "colorsYes" | "colorsNo" | "deadline";

const TEXT_FIELDS: { key: TextKey; label: string; hint: string; rows: number; placeholder: string }[] = [
  {
    key: "activity",
    label: "1. Nom et activité",
    hint: "Le nom exact, tel qu'il doit apparaître.",
    rows: 1,
    placeholder: "Atelier Marceau, menuiserie sur mesure",
  },
  {
    key: "pitch",
    label: "2. Ce que vous vendez, en une phrase",
    hint: "Une seule phrase. Celle que vous diriez à un client pressé.",
    rows: 2,
    placeholder: "Je fabrique des cuisines en bois massif pour des appartements anciens.",
  },
  {
    key: "clients",
    label: "3. À qui vous parlez",
    hint: "Âge, lieu, métier, niveau de budget. Ce que vous savez vraiment.",
    rows: 2,
    placeholder: "Propriétaires de 35 à 60 ans en Île-de-France, rénovation haut de gamme.",
  },
  {
    key: "references",
    label: "4. Trois marques de référence",
    hint: "Pas forcément votre secteur. Ce qui vous plaît dans leur travail.",
    rows: 2,
    placeholder: "Aesop pour la sobriété, Kinfolk pour la photo, une menuiserie japonaise pour la finesse.",
  },
  {
    key: "difference",
    label: "5. Ce qui vous différencie",
    hint: "Ce qu'un concurrent ne peut pas dire à votre place.",
    rows: 2,
    placeholder: "Je livre en six semaines et je pose moi-même, sans sous-traitance.",
  },
  {
    key: "colorsNo",
    label: "8. Couleurs à éviter",
    hint: "Celles qui vous déplaisent, ou déjà prises par un concurrent.",
    rows: 1,
    placeholder: "Le bleu marine des cuisinistes, le rouge vif.",
  },
  {
    key: "colorsYes",
    label: "8 bis. Couleurs que vous aimez",
    hint: "Facultatif. Le ton général suffit.",
    rows: 1,
    placeholder: "Les bruns chauds, le vert olive, les papiers non couchés.",
  },
  {
    key: "deadline",
    label: "10. Échéance",
    hint: "Une date réelle, même approximative.",
    rows: 1,
    placeholder: "Ouverture en mars, salons professionnels en juin.",
  },
];

export function IdentiteBriefGenerator() {
  const [answers, setAnswers] = useState<BriefAnswers>(emptyBrief);
  const [status, setStatus] = useState("");

  const state = useMemo(() => completeness(answers), [answers]);
  const text = useMemo(() => briefToText(answers), [answers]);

  useEffect(() => {
    if (status.length === 0) return;
    const timer = window.setTimeout(() => setStatus(""), 3200);
    return () => window.clearTimeout(timer);
  }, [status]);

  function setText(key: TextKey, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function toggleTrait(trait: string) {
    setAnswers((current) => {
      if (current.traits.includes(trait)) {
        return { ...current, traits: current.traits.filter((item) => item !== trait) };
      }
      if (current.traits.length >= 3) return current;
      return { ...current, traits: [...current.traits, trait] };
    });
  }

  function toggleSupport(id: string) {
    setAnswers((current) => ({
      ...current,
      supports: current.supports.includes(id)
        ? current.supports.filter((item) => item !== id)
        : [...current.supports, id],
    }));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Brief copié, à coller dans un mail ou un document.");
    } catch {
      setStatus("Copie refusée par le navigateur. Utilise l'impression PDF.");
    }
  }

  function print() {
    const win = window.open("", "_blank", "width=820,height=1000");
    if (!win) {
      setStatus("Fenêtre bloquée. Autorise les pop-ups pour exporter en PDF.");
      return;
    }
    win.document.write(briefToHtml(answers));
    win.document.close();
    win.focus();
    window.setTimeout(() => win.print(), 400);
    setStatus("Fenêtre d'impression ouverte : choisis « Enregistrer au format PDF ».");
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <p className={styles.progress} aria-live="polite">
          <strong>{state.filled}</strong> sur {state.total} points essentiels remplis
        </p>
        <div className={styles.track} aria-hidden="true">
          <span
            className={styles.trackFill}
            style={{ width: `${Math.round((state.filled / state.total) * 100)}%` }}
          />
        </div>
      </div>

      <div className={styles.fieldset}>
        {TEXT_FIELDS.slice(0, 5).map((field) => (
          <label key={field.key} className={styles.field}>
            <span className={styles.label}>{field.label}</span>
            <span className={styles.hint}>{field.hint}</span>
            <textarea
              className={styles.input}
              rows={field.rows}
              value={answers[field.key]}
              placeholder={field.placeholder}
              onChange={(event) => setText(field.key, event.target.value)}
            />
          </label>
        ))}

        <div className={styles.field}>
          <span className={styles.label}>6. Trois adjectifs</span>
          <span className={styles.hint}>Trois maximum. Ce qui reste cohérent avec le positionnement.</span>
          <div className={styles.chips}>
            {TRAITS.map((trait) => {
              const active = answers.traits.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  className={active ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  aria-pressed={active}
                  onClick={() => toggleTrait(trait)}
                >
                  {trait}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>7. Où le logo va vivre</span>
          <span className={styles.hint}>Coche ce qui est déjà prévu, même pour plus tard.</span>
          <div className={styles.checks}>
            {SUPPORTS.map((support) => (
              <label key={support.id} className={styles.check}>
                <input
                  type="checkbox"
                  checked={answers.supports.includes(support.id)}
                  onChange={() => toggleSupport(support.id)}
                />
                <span>{support.label}</span>
              </label>
            ))}
          </div>
        </div>

        {TEXT_FIELDS.slice(5, 7).map((field) => (
          <label key={field.key} className={styles.field}>
            <span className={styles.label}>{field.label}</span>
            <span className={styles.hint}>{field.hint}</span>
            <textarea
              className={styles.input}
              rows={field.rows}
              value={answers[field.key]}
              placeholder={field.placeholder}
              onChange={(event) => setText(field.key, event.target.value)}
            />
          </label>
        ))}

        <div className={styles.field}>
          <span className={styles.label}>9. Ce qui existe déjà</span>
          <span className={styles.hint}>Pour éviter de découvrir un obstacle au milieu du projet.</span>
          <div className={styles.checks}>
            {EXISTING.map((item) => (
              <label key={item.id} className={styles.check}>
                <input
                  type="radio"
                  name="existing"
                  checked={answers.existing === item.id}
                  onChange={() =>
                    setAnswers((current) => ({ ...current, existing: item.id as ExistingId }))
                  }
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>10. Échéance</span>
          <span className={styles.hint}>Une date réelle, même approximative.</span>
          <input
            className={styles.input}
            type="text"
            value={answers.deadline}
            placeholder="Ouverture en mars, salons professionnels en juin."
            onChange={(event) => setText("deadline", event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>10 bis. Fourchette de budget</span>
          <span className={styles.hint}>Les fourchettes du studio, pour situer le niveau de finition.</span>
          <select
            className={styles.input}
            value={answers.budget}
            onChange={(event) => setAnswers((current) => ({ ...current, budget: event.target.value }))}
          >
            <option value="">Choisir une fourchette</option>
            {BUDGETS.map((budget) => (
              <option key={budget} value={budget}>
                {budget}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.summaryWrap}>
        <div className={styles.summaryHead}>
          <p className={styles.summaryLabel}>Aperçu du brief</p>
          {state.missing.length > 0 ? (
            <p className={styles.missing}>Reste à traiter : {state.missing.join(", ")}.</p>
          ) : (
            <p className={styles.ready}>Les points essentiels sont couverts.</p>
          )}
        </div>
        <pre className={styles.summary}>{text}</pre>
        <div className={styles.actions}>
          <button type="button" className="btn-fill" onClick={print}>
            Exporter en PDF
          </button>
          <button type="button" className="btn-line" onClick={copy}>
            Copier le brief
          </button>
          <button
            type="button"
            className={styles.reset}
            onClick={() => {
              setAnswers(emptyBrief());
              setStatus("Formulaire remis à zéro.");
            }}
          >
            Réinitialiser
          </button>
        </div>
        <p className={styles.status} aria-live="polite">
          {status}
        </p>
        <p className={styles.privacy}>
          Tout se passe dans votre navigateur. Aucune réponse n&apos;est envoyée, enregistrée ni relue
          par le studio tant que vous ne nous écrivez pas.
        </p>
      </div>
    </div>
  );
}
