import { describe, expect, it } from "vitest";
import {
  CONTACT_EMAIL,
  CONTACT_PHONE,
  CONTACT_PHONE_HREF,
  mailto,
  routes,
  servicePath,
  serviceSlugs,
} from "@/lib/routes";

describe("table des routes", () => {
  it("expose la racine", () => {
    expect(routes.home).toBe("/");
  });

  it("numérote les cinq services dans l'ordre éditorial", () => {
    expect(serviceSlugs).toHaveLength(5);
    expect(servicePath("agents-ia")).toBe("/services/agents-ia");
  });

  it("publie les coordonnées du studio", () => {
    expect(CONTACT_EMAIL).toBe("hello@sujeedesign.com");
    expect(CONTACT_PHONE).toBe("06 51 51 74 63");
    expect(CONTACT_PHONE_HREF).toBe("tel:+33651517463");
  });

  it("construit un mailto avec sujet encodé", () => {
    expect(mailto("Un projet")).toBe(`mailto:${CONTACT_EMAIL}?subject=Un%20projet`);
    expect(mailto()).toBe(`mailto:${CONTACT_EMAIL}`);
  });
});
