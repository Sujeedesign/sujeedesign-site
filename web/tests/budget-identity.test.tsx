import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BudgetIdentityCalculator } from "@/components/BudgetIdentityCalculator";
import { CalculateurBudget, faqItems } from "@/components/pages/CalculateurBudget";
import { BASES, OPTIONS, computeBudget } from "@/lib/budget-identity";
import { routes } from "@/lib/routes";
import sitemap from "@/app/sitemap";

describe("règles de calcul du budget identité", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("additionne les bornes sans les arrondir", () => {
    // 2 500 + 250 = 2 750 exactement ; 3 500 + 450 = 3 950.
    const result = computeBudget("complete", ["carte"]);
    expect(result?.range).toEqual({ low: 2750, high: 3950 });
  });

  it("ne renvoie aucun résultat tant qu'aucun point de départ n'est choisi", () => {
    expect(computeBudget(null, [])).toBeNull();
    expect(computeBudget(null, ["carte"])).toBeNull();
  });

  it("additionne les bornes basses entre elles et les bornes hautes entre elles", () => {
    const result = computeBudget("complete", ["carte"]);
    expect(result).not.toBeNull();
    expect(result?.lines.map((line) => line.id)).toEqual(["complete", "carte"]);
  });

  it("cumule toutes les options", () => {
    const result = computeBudget("essentiel", OPTIONS.map((option) => option.id));
    // 650 + 250 + 150 + 150 + 600 + 150 + 250 = 2 200
    // 900 + 450 + 300 + 350 + 1 500 + 400 + 450 = 4 350
    expect(result?.range).toEqual({ low: 2200, high: 4350 });
    expect(result?.options).toHaveLength(OPTIONS.length);
  });

  it("produit un récapitulatif copiable et trois postes principaux", () => {
    const result = computeBudget("essentiel", ["carte"]);
    expect(result?.recap).toBe(
      "Logo Essentiel (650 € à 900 €) + carte de visite (250 € à 450 €) : total estimé entre 900 € et 1\u202f350 €.",
    );
    expect(result?.top).toHaveLength(2);
    expect(
      computeBudget("essentiel", ["carte", "brochure", "picto"])?.top,
    ).toHaveLength(3);
  });

  it("garde les fourchettes de la grille validée, sans chevauchement incohérent", () => {
    expect(BASES.map((base) => [base.id, base.range.low, base.range.high])).toEqual([
      ["essentiel", 650, 900],
      ["refonte", 800, 1500],
      ["signature", 1200, 1800],
      ["starter", 1500, 2200],
      ["complete", 2500, 3500],
      ["avance", 4000, 6000],
    ]);
    expect(OPTIONS.map((option) => [option.id, option.range.low, option.range.high])).toEqual([
      ["carte", 250, 450],
      ["email", 150, 300],
      ["post", 150, 350],
      ["brochure", 600, 1500],
      ["picto", 150, 400],
      ["piste", 250, 450],
    ]);
  });

  it("classe les offres par prix croissant", () => {
    // Garde-fou : la refonte repart d'un logo existant, elle ne peut pas coûter
    // plus cher qu'une création complète placée au-dessus d'elle dans la liste.
    const lows = BASES.map((base) => base.range.low);
    const highs = BASES.map((base) => base.range.high);
    expect([...lows].sort((a, b) => a - b)).toEqual(lows);
    expect([...highs].sort((a, b) => a - b)).toEqual(highs);
    expect(BASES[0]?.id).toBe("essentiel");
    expect(BASES[BASES.length - 1]?.id).toBe("avance");
  });
});

describe("composant calculateur", () => {
  it("invite à choisir un point de départ et verrouille les options", () => {
    const { container } = render(<BudgetIdentityCalculator />);
    expect(screen.getByRole("status")).toHaveTextContent("Choisissez au moins un point de départ");
    for (const input of container.querySelectorAll<HTMLInputElement>('input[name="budget-options"]')) {
      expect(input.disabled).toBe(true);
    }
  });

  it("affiche le total et le détail du niveau choisi", () => {
    const { container } = render(<BudgetIdentityCalculator />);

    const complete = container.querySelector<HTMLInputElement>('input[value="complete"]');
    if (!complete) throw new Error("radio « identité complète » absente");
    fireEvent.click(complete);

    expect(screen.getByRole("status")).toHaveTextContent("2 500 €");
    expect(screen.getByRole("status")).toHaveTextContent("3 500 €");

    const carte = container.querySelector<HTMLInputElement>('input[value="carte"]');
    if (!carte) throw new Error("case « carte de visite » absente");
    fireEvent.click(carte);

    expect(screen.getByRole("status")).toHaveTextContent("2 750 €");
    expect(screen.getByRole("status")).toHaveTextContent("3 950 €");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Les deux postes qui pèsent le plus dans ce budget : Identité Complète et carte de visite.",
    );
    expect(screen.getByText("Copier le récapitulatif")).toBeInTheDocument();
  });

  it("adapte la phrase du résumé quand un seul poste est retenu", () => {
    const { container } = render(<BudgetIdentityCalculator />);

    const complete = container.querySelector<HTMLInputElement>('input[value="complete"]');
    if (!complete) throw new Error("radio « identité complète » absente");
    fireEvent.click(complete);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Le poste qui pèse le plus dans ce budget : Identité Complète.",
    );
  });
});

describe("page calculateur", () => {
  it("rend les tableaux et la FAQ côté serveur", () => {
    const { container } = render(<CalculateurBudget />);

    // Trois tableaux : niveaux, options, puis temps de travail par étape.
    const tables = container.querySelectorAll("table");
    expect(tables).toHaveLength(3);
    const [tableNiveaux, tableOptions, tableTemps] = Array.from(tables);
    if (!tableNiveaux || !tableOptions || !tableTemps) throw new Error("tableaux manquants");
    expect(tableNiveaux.querySelectorAll("tbody tr")).toHaveLength(BASES.length);
    expect(tableOptions.querySelectorAll("tbody tr")).toHaveLength(OPTIONS.length);
    expect(tableTemps.querySelectorAll("tbody tr")).toHaveLength(7);

    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(faqItems.length);
    expect(faqItems).toHaveLength(8);
    expect(container).toHaveTextContent("Combien coûte");
    expect(container).toHaveTextContent("Ce qui est inclus dans chaque niveau");
    expect(container).toHaveTextContent("Un logo à 200 € ou un logo de designer ?");
    expect(container).toHaveTextContent("Et un logo généré par une IA ?");
  });

  it("pointe vers le service identité et vers le contact", () => {
    const { container } = render(<CalculateurBudget />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(routes.contact);
    expect(hrefs).toContain("/services/identite-de-marque");
  });

  it("figure dans le sitemap", async () => {
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toContain(
      `https://sujeedesign.com${routes.calculateurBudgetIdentite}`,
    );
  });
});
