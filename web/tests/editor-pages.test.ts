import { describe, expect, it } from "vitest";

import { editableSlug, normalizePath, pageSlug } from "@/lib/editor-pages";

describe("pages éditables en place", () => {
  it("reconnaît les cinq pages branchées sur le modèle de contenu", () => {
    expect(editableSlug("/")).toBe("home");
    expect(editableSlug("/services")).toBe("services");
    expect(editableSlug("/realisations")).toBe("realisations");
    expect(editableSlug("/a-propos")).toBe("a-propos");
    expect(editableSlug("/agents-ia")).toBe("agents-ia");
  });

  it("reconnaît les quatre fiches service, branchées sur leur propre document", () => {
    // Régression : le premier segment renvoyait « services ». Chaque fiche a
    // désormais son slug et ses data-field.
    for (const slug of ["identite-de-marque", "direction-artistique", "site-ecommerce", "contenu-reseaux"]) {
      expect(editableSlug(`/services/${slug}`)).toBe(slug);
    }
  });

  it("ignore les fiches réalisation et les pages hors modèle", () => {
    expect(editableSlug("/realisations/dekra")).toBeNull();
    expect(editableSlug("/contact")).toBeNull();
    expect(editableSlug("/mentions-legales")).toBeNull();
    expect(editableSlug("/admin/prestations")).toBeNull();
  });

  it("tolère la barre finale, les paramètres et le fragment", () => {
    expect(editableSlug("/services/")).toBe("services");
    expect(editableSlug("/services/?x=1")).toBe("services");
    expect(editableSlug("/a-propos#equipe")).toBe("a-propos");
    expect(normalizePath("///")).toBe("/");
  });

  it("replie sur home pour la sonde de session", () => {
    expect(pageSlug("/services/site-ecommerce")).toBe("site-ecommerce");
    expect(pageSlug("/services")).toBe("services");
  });
});
