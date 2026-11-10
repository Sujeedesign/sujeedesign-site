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
    // 2 200 + 180 = 2 380 exactement ; 4 000 + 350 = 4 350.
    const result = computeBudget("complete", ["carte"]);
    expect(result?.range).toEqual({ low: 2380, high: 4350 });
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
    // 1 900 + 180 + 220 + 40 + 320 + 710 + 180 = 3 550
    // 3 000 + 350 + 450 + 80 + 500 + 1 500 + 350 = 6 230
    expect(result?.range).toEqual({ low: 3550, high: 6230 });
    expect(result?.options).toHaveLength(OPTIONS.length);
  });

  it("produit un récapitulatif copiable et trois postes principaux", () => {
    const result = computeBudget("essentiel", ["carte"]);
    expect(result?.recap).toBe(
      "Pack Identité Essentiel (1\u202f900 € à 3\u202f000 €) + carte de visite (180 € à 350 €) : total estimé entre 2\u202f080 € et 3\u202f350 €.",
    );
    expect(result?.top).toHaveLength(2);
    expect(
      computeBudget("essentiel", ["carte", "plaquette", "affiche"])?.top,
    ).toHaveLength(3);
  });

  it("garde les fourchettes de la grille validée, sans chevauchement incohérent", () => {
    expect(BASES.map((base) => [base.id, base.range.low, base.range.high])).toEqual([
      ["logo", 800, 1500],
      ["logo-declinaisons", 1100, 1500],
      ["charte", 1200, 2500],
      ["essentiel", 1900, 3000],
      ["complete", 2200, 4000],
      ["complet", 3200, 5000],
      ["rebranding", 3500, 6000],
    ]);
    expect(OPTIONS.map((option) => [option.id, option.range.low, option.range.high])).toEqual([
      ["carte", 180, 350],
      ["flyer", 220, 450],
      ["post", 40, 80],
      ["affiche", 320, 500],
      ["plaquette", 710, 1500],
      ["menu", 180, 350],
    ]);
  });

  it("classe les offres par prix croissant", () => {
    // Garde-fou : chaque niveau reprend le travail du précédent, la liste doit
    // donc rester croissante à la lecture.
    const lows = BASES.map((base) => base.range.low);
    const highs = BASES.map((base) => base.range.high);
    expect([...lows].sort((a, b) => a - b)).toEqual(lows);
    expect([...highs].sort((a, b) => a - b)).toEqual(highs);
    expect(BASES[0]?.id).toBe("logo");
    expect(BASES[BASES.length - 1]?.id).toBe("rebranding");
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

    expect(screen.getByRole("status")).toHaveTextContent("2 200 €");
    expect(screen.getByRole("status")).toHaveTextContent("4 000 €");

    const carte = container.querySelector<HTMLInputElement>('input[value="carte"]');
    if (!carte) throw new Error("case « carte de visite » absente");
    fireEvent.click(carte);

    expect(screen.getByRole("status")).toHaveTextContent("2 380 €");
    expect(screen.getByRole("status")).toHaveTextContent("4 350 €");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Les deux postes qui pèsent le plus dans ce budget : Identité visuelle complète et carte de visite.",
    );
    expect(screen.getByText("Copier le récapitulatif")).toBeInTheDocument();
  });

  it("adapte la phrase du résumé quand un seul poste est retenu", () => {
    const { container } = render(<BudgetIdentityCalculator />);

    const complete = container.querySelector<HTMLInputElement>('input[value="complete"]');
    if (!complete) throw new Error("radio « identité complète » absente");
    fireEvent.click(complete);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Le poste qui pèse le plus dans ce budget : Identité visuelle complète.",
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
