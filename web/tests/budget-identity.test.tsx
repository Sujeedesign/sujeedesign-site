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
import { BASES, OPTIONS, computeBudget, isOptionAvailable } from "@/lib/budget-identity";
import { routes } from "@/lib/routes";
import sitemap from "@/app/sitemap";

describe("règles de calcul du budget identité", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("additionne les bornes sans les arrondir", () => {
    // 1 500 + 150 = 1 650 exactement ; 4 000 + 500 = 4 500.
    const result = computeBudget("complete", ["papeterie"]);
    expect(result?.range).toEqual({ low: 1650, high: 4500 });
  });

  it("ne renvoie aucun résultat tant qu'aucun point de départ n'est choisi", () => {
    expect(computeBudget(null, [])).toBeNull();
    expect(computeBudget(null, ["papeterie"])).toBeNull();
  });

  it("additionne les bornes basses entre elles et les bornes hautes entre elles", () => {
    const result = computeBudget("complete", ["papeterie"]);
    expect(result).not.toBeNull();
    // 1 500 + 150 = 1 650 ; 4 000 + 500 = 4 500.
    expect(result?.range).toEqual({ low: 1650, high: 4500 });
    expect(result?.lines.map((line) => line.id)).toEqual(["complete", "papeterie"]);
  });

  it("cumule toutes les options disponibles", () => {
    const result = computeBudget("logo", OPTIONS.map((option) => option.id));
    // 600 + 900 + 150 + 400 + 80 + 350 = 2 480
    // 1 500 + 2 500 + 500 + 1 500 + 300 + 900 = 7 200
    expect(result?.range).toEqual({ low: 2480, high: 7200 });
    expect(result?.options).toHaveLength(OPTIONS.length);
  });

  it("désactive la charte quand le niveau l'inclut déjà", () => {
    expect(isOptionAvailable("charte", "complete")).toBe(false);
    expect(isOptionAvailable("charte", "refonte")).toBe(false);
    expect(isOptionAvailable("charte", "logo")).toBe(true);
    expect(isOptionAvailable("papeterie", "complete")).toBe(true);

    // Une charte cochée avant de passer à « identité complète » ne compte pas.
    const result = computeBudget("complete", ["charte"]);
    expect(result?.range).toEqual({ low: 1500, high: 4000 });
    expect(result?.options).toEqual([]);
  });

  it("produit un récapitulatif copiable et trois postes principaux", () => {
    const result = computeBudget("logo", ["charte"]);
    expect(result?.recap).toBe(
      "Logo (600 € à 1\u202f500 €) + charte graphique détaillée (900 € à 2\u202f500 €) : total estimé entre 1\u202f500 € et 4\u202f000 €.",
    );
    expect(result?.top).toHaveLength(2);
    expect(computeBudget("logo", ["charte", "papeterie", "packaging", "photo"])?.top).toHaveLength(3);
  });

  it("garde les fourchettes du brief pour chaque niveau et chaque option", () => {
    expect(BASES.map((base) => [base.id, base.range.low, base.range.high])).toEqual([
      ["logo", 600, 1500],
      ["declinaisons", 800, 1500],
      ["complete", 1500, 4000],
      ["refonte", 3000, 6000],
    ]);
    expect(OPTIONS.map((option) => [option.id, option.range.low, option.range.high])).toEqual([
      ["charte", 900, 2500],
      ["papeterie", 150, 500],
      ["packaging", 400, 1500],
      ["reseaux", 80, 300],
      ["photo", 350, 900],
    ]);
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

  it("affiche le total et neutralise la charte pour une identité complète", () => {
    const { container } = render(<BudgetIdentityCalculator />);

    const complete = container.querySelector<HTMLInputElement>('input[value="complete"]');
    if (!complete) throw new Error("radio « identité complète » absente");
    fireEvent.click(complete);

    const charte = container.querySelector<HTMLInputElement>('input[value="charte"]');
    if (!charte) throw new Error("case « charte » absente");
    expect(charte.disabled).toBe(true);
    expect(screen.getAllByText("déjà incluse").length).toBeGreaterThan(0);

    const papeterie = container.querySelector<HTMLInputElement>('input[value="papeterie"]');
    if (!papeterie) throw new Error("case « papeterie » absente");
    fireEvent.click(papeterie);

    expect(screen.getByRole("status")).toHaveTextContent("1 650 €");
    expect(screen.getByRole("status")).toHaveTextContent("4 500 €");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Les deux postes qui pèsent le plus dans ce budget : Identité complète et papeterie.",
    );
    expect(screen.getByText("Copier le récapitulatif")).toBeInTheDocument();
  });

  it("adapte la phrase du résumé quand un seul poste est retenu", () => {
    const { container } = render(<BudgetIdentityCalculator />);

    const complete = container.querySelector<HTMLInputElement>('input[value="complete"]');
    if (!complete) throw new Error("radio « identité complète » absente");
    fireEvent.click(complete);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Le poste qui pèse le plus dans ce budget : Identité complète.",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent("trois postes");
  });
});

describe("page calculateur", () => {
  it("rend les tableaux et la FAQ côté serveur", () => {
    const { container } = render(<CalculateurBudget />);

    const rows = container.querySelectorAll("table tbody tr");
    expect(rows).toHaveLength(BASES.length + OPTIONS.length);

    const details = container.querySelectorAll("details");
    expect(details).toHaveLength(faqItems.length);
    expect(container).toHaveTextContent("Combien coûte");
    expect(container).toHaveTextContent("Ce qui est inclus dans chaque niveau");
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
