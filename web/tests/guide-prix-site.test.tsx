import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { GuidePrixSite, aeo, faqItems, pageMeta } from "@/components/pages/GuidePrixSite";

describe("guide prix d'un site internet", () => {
  it("rend un seul h1, cinq tableaux et la FAQ en clair", () => {
    const { container } = render(<GuidePrixSite />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("table")).toHaveLength(5);
    expect(container.querySelectorAll("details")).toHaveLength(faqItems.length);
    expect(container).toHaveTextContent("Combien coûte");
  });

  it("affiche les prix de la grille et les coûts récurrents", () => {
    const { container } = render(<GuidePrixSite />);
    for (const prix of ["2 000 €", "2 750 €", "4 000 €", "1 250 €", "62,50 € / heure"]) {
      expect(container).toHaveTextContent(prix);
    }
    expect(container).toHaveTextContent("Nom de domaine");
    expect(container).toHaveTextContent("Hébergement");
  });

  it("garde la réponse « En bref » longue et factuelle", () => {
    const mots = aeo.answer.split(/\s+/).length;
    expect(mots).toBeGreaterThan(80);
    expect(mots).toBeLessThan(170);
    expect(aeo.answer).toContain("2 750 €");
  });

  it("garde un titre et une description dans les limites SEO", () => {
    expect(pageMeta.title.length).toBeLessThanOrEqual(60);
    expect(pageMeta.description.length).toBeLessThanOrEqual(155);
  });
});
