import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { GuidePrixLogo, faqItems, pageMeta } from "@/components/pages/GuidePrixLogo";
import { RessourcesHub } from "@/components/pages/RessourcesHub";
import { routes } from "@/lib/routes";
import sitemap from "@/app/sitemap";

describe("guide prix du logo", () => {
  it("rend un seul h1, les trois tableaux et la FAQ en clair", () => {
    const { container } = render(<GuidePrixLogo />);

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const tables = container.querySelectorAll("table");
    expect(tables).toHaveLength(3);
    expect(container.querySelectorAll("details")).toHaveLength(faqItems.length);
    expect(faqItems).toHaveLength(6);
    expect(container).toHaveTextContent("Combien coûte");
    expect(container).toHaveTextContent("Ce qui manque dans un devis à 200 €");
  });

  it("affiche les fourchettes de la grille 2026", () => {
    const { container } = render(<GuidePrixLogo />);
    for (const range of [
      "650 à 900 €",
      "800 à 1 500 €",
      "1 200 à 1 800 €",
      "1 500 à 2 200 €",
      "2 500 à 3 500 €",
      "4 000 à 6 000 €",
    ]) {
      expect(container).toHaveTextContent(range);
    }
  });

  it("renvoie vers le calculateur et vers l'offre identité", () => {
    const { container } = render(<GuidePrixLogo />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(routes.calculateurBudgetIdentite);
    expect(hrefs).toContain("/services/identite-de-marque");
  });

  it("garde un titre et une description dans les limites SEO", () => {
    expect(pageMeta.title.length).toBeLessThanOrEqual(60);
    expect(pageMeta.description.length).toBeLessThanOrEqual(155);
  });
});

describe("hub ressources", () => {
  it("liste les deux pages existantes, et seulement elles", () => {
    const { container } = render(<RessourcesHub />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(routes.calculateurBudgetIdentite);
    expect(hrefs).toContain(routes.guidePrixLogo);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(screen.getByText("Calculateur de budget identité visuelle")).toBeInTheDocument();
  });
});

describe("indexation des pages ressources", () => {
  it("inscrit le hub et le guide dans le sitemap", async () => {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    expect(urls).toContain(`https://sujeedesign.com${routes.ressources}`);
    expect(urls).toContain(`https://sujeedesign.com${routes.guidePrixLogo}`);
  });
});
