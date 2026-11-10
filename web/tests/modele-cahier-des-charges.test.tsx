import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  ModeleCahierDesCharges,
  aeo,
  faqItems,
  pageMeta,
} from "@/components/pages/ModeleCahierDesCharges";

describe("modèle de cahier des charges", () => {
  it("rend un seul h1 et les deux tableaux de la page", () => {
    const { container } = render(<ModeleCahierDesCharges />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("table")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(16);
  });

  it("libelle chaque cellule de tableau pour l'affichage mobile", () => {
    const { container } = render(<ModeleCahierDesCharges />);
    const cells = [...container.querySelectorAll("tbody td")];
    expect(cells.length).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell.getAttribute("data-label")).toBeTruthy();
    }
  });

  it("expose les douze blocs dans l'ordre", () => {
    const { container } = render(<ModeleCahierDesCharges />);
    const titres = [...container.querySelectorAll("tbody th")].map((th) =>
      th.textContent?.trim(),
    );
    expect(titres).toHaveLength(16);
    expect(titres[0]).toMatch(/^01 · Le projet en une page$/);
    expect(titres[11]).toMatch(/^12 · Après la mise en ligne$/);
  });

  it("pointe vers les deux fichiers téléchargeables", () => {
    const { container } = render(<ModeleCahierDesCharges />);
    const liens = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(liens).toContain("/assets/ressources/cahier-des-charges-site-2026.docx");
    expect(liens).toContain("/assets/ressources/cahier-des-charges-site-2026.pdf");
  });

  it("garde la réponse « En bref » longue et factuelle", () => {
    const mots = aeo.answer.split(/\s+/).length;
    expect(mots).toBeGreaterThan(80);
    expect(mots).toBeLessThan(170);
  });

  it("garde un titre et une description dans les limites SEO", () => {
    expect(pageMeta.title.length).toBeLessThanOrEqual(60);
    expect(pageMeta.description.length).toBeLessThanOrEqual(155);
    expect(faqItems.length).toBeGreaterThanOrEqual(5);
  });
});
