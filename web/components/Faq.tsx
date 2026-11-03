import type { ReactNode } from "react";

export type FaqItem = { question: string; answer: string };

/**
 * Bloc « Questions fréquentes » commun aux guides et aux outils.
 * Titre display plein cadre, filet d'accent au-dessus, filet d'encre dessous,
 * lignes séparées par un filet clair et état ouvert surligné.
 */
export default function Faq({
  items,
  title = "Questions fréquentes",
  id = "faq",
  eyebrow,
}: {
  items: FaqItem[];
  title?: string;
  id?: string;
  eyebrow?: ReactNode;
}) {
  if (!items?.length) return null;
  return (
    <section className="faqblock">
      <header className="faqhead">
        {eyebrow ? <p className="faqeyebrow">{eyebrow}</p> : null}
        <h2 id={id}>{title}</h2>
      </header>
      <div className="faq">
        {items.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <div className="faqanswer">
              <p>{item.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
