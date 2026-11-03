import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { GenerateurBrief, faqItems, pageMeta } from "@/components/pages/GenerateurBrief";
import { RessourcesHub } from "@/components/pages/RessourcesHub";
import sitemap from "@/app/sitemap";
import { routes } from "@/lib/routes";
import {
  BUDGETS,
  STEPS,
  briefToHtml,
  briefToText,
  completeness,
  emptyBrief,
  type BriefAnswers,
} from "@/lib/logo-brief";

const FILLED: BriefAnswers = {
  ...emptyBrief(),
  activity: "Atelier Marceau, menuiserie",
  pitch: "Des cuisines en bois massif pour appartements anciens.",
  clients: "Propriétaires de 35 à 60 ans en Île-de-France.",
  difference: "Livraison en six semaines, pose par l'atelier.",
  traits: ["Sobre", "Artisanal", "Premium"],
  supports: ["logo", "carte", "enseigne"],
  existing: "ancien",
  deadline: "Ouverture en mars",
  budget: "1 500 € à 2 200 €",
};

describe("brief identité : complétude", () => {
  it("part de zéro point rempli", () => {
    const state = completeness(emptyBrief());
    expect(state.filled).toBe(0);
    expect(state.total).toBe(7);
    expect(state.missing).toHaveLength(7);
  });

  it("compte sept points essentiels sur un brief complet", () => {
    const state = completeness(FILLED);
    expect(state.filled).toBe(7);
    expect(state.missing).toHaveLength(0);
  });

  it("ignore les champs facultatifs vides", () => {
    const state = completeness({ ...FILLED, references: "", colorsYes: "", colorsNo: "" });
    expect(state.missing).toHaveLength(0);
  });

  it("signale le premier point manquant par son intitulé", () => {
    const state = completeness({ ...emptyBrief(), activity: "Atelier Marceau" });
    expect(state.missing[0]).toBe("Ce que vous vendez, en une phrase");
  });
});

describe("brief identité : export texte", () => {
  it("reprend chaque réponse et les libellés des supports", () => {
    const text = briefToText(FILLED);
    expect(text).toContain("Atelier Marceau, menuiserie");
    expect(text).toContain("Sobre, Artisanal, Premium");
    expect(text).toContain("Le logo seul, Carte de visite, Enseigne ou vitrine");
    expect(text).toContain("Un logo existe mais il est daté");
    expect(text).toContain("1 500 € à 2 200 €");
  });

  it("marque « à compléter » au lieu d'un vide", () => {
    const text = briefToText({ ...emptyBrief(), activity: "Test" });
    expect(text).toContain("Clients visés : à compléter");
    expect(text).not.toContain("undefined");
  });

  it("exporte un HTML imprimable qui échappe les balises", () => {
    const html = briefToHtml({ ...FILLED, activity: "<script>alert(1)</script>" });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("@page");
  });
});

describe("brief identité : contenu", () => {
  it("déroule dix questions, toutes documentées", () => {
    expect(STEPS).toHaveLength(10);
    for (const step of STEPS) {
      expect(step.why.length).toBeGreaterThan(30);
      expect(step.error.length).toBeGreaterThan(30);
    }
    expect(new Set(STEPS.map((step) => step.num)).size).toBe(10);
  });

  it("propose les six fourchettes du studio plus « à définir »", () => {
    expect(BUDGETS).toHaveLength(7);
    expect(BUDGETS).toContain("650 € à 900 €");
    expect(BUDGETS).toContain("Je ne sais pas encore");
  });

  it("rend la page avec un seul h1 et l'outil", () => {
    const { container } = render(<GenerateurBrief />);
    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelectorAll("details")).toHaveLength(faqItems.length);
    expect(container.querySelectorAll("textarea").length).toBeGreaterThanOrEqual(7);
    expect(container).toHaveTextContent("Exporter en PDF");
  });

  it("garde un titre et une description dans les limites SEO", () => {
    expect(pageMeta.title.length).toBeLessThanOrEqual(60);
    expect(pageMeta.description.length).toBeLessThanOrEqual(155);
  });
});

describe("maillage des ressources", () => {
  it("le hub liste les trois pages", () => {
    const { container } = render(<RessourcesHub />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(hrefs).toContain(routes.calculateurBudgetIdentite);
    expect(hrefs).toContain(routes.guidePrixLogo);
    expect(hrefs).toContain(routes.generateurBriefIdentite);
  });

  it("le sitemap contient le générateur", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain(`https://sujeedesign.com${routes.generateurBriefIdentite}`);
  });
});
