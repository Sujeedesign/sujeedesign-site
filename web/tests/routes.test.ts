import { describe, expect, it } from "vitest";
import { routes, servicePath, serviceSlugs, mailto, CONTACT_EMAIL } from "@/lib/routes";

describe("table des routes", () => {
  it("expose la racine", () => {
    expect(routes.home).toBe("/");
  });

  it("numérote les cinq services dans l'ordre éditorial", () => {
    expect(serviceSlugs).toHaveLength(5);
    expect(servicePath("agents-ia")).toBe("/services/agents-ia");
  });

  it("construit un mailto avec sujet encodé", () => {
    expect(mailto("Un projet")).toBe(`mailto:${CONTACT_EMAIL}?subject=Un%20projet`);
    expect(mailto()).toBe(`mailto:${CONTACT_EMAIL}`);
  });
});
