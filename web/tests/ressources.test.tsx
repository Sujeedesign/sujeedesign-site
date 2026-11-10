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
  it("rend un seul h1, les quatre tableaux et la FAQ en clair", () => {
    const { container } = render(<GuidePrixLogo />);

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    const tables = container.querySelectorAll("table");
    expect(tables).toHaveLength(4);
    expect(container.querySelectorAll("details")).toHaveLength(faqItems.length);
    expect(faqItems).toHaveLength(7);
    expect(container).toHaveTextContent("Combien coûte");
    expect(container).toHaveTextContent("Ce qui manque dans un devis à 200 €");
  });

  it("affiche les prix de la grille appliquée et les repères de marché", () => {
    const { container } = render(<GuidePrixLogo />);
    for (const prix of ["800 €", "1 100 €", "1 200 €", "1 900 €", "2 200 €", "3 200 €", "3 500 €"]) {
      expect(container).toHaveTextContent(prix);
    }
    // Prix moyens du marché, novembre 2026, sans citer de concurrent.
    for (const moyenne of ["1 100 €", "2 000 €", "900 €", "4 000 €"]) {
      expect(container).toHaveTextContent(moyenne);
    }
    expect(container).not.toHaveTextContent("La Fabrique du Net");
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
  it("liste les pages existantes du hub", () => {
    const { container } = render(<RessourcesHub />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(routes.calculateurBudgetIdentite);
    expect(hrefs).toContain(routes.guidePrixLogo);
    expect(hrefs).toContain(routes.guidePrixSite);
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
    expect(urls).toContain(`https://sujeedesign.com${routes.guidePrixSite}`);
  });
});
