import { describe, expect, it } from "vitest";

import { contactLinks } from "@/lib/content/contact-links";

describe("contactLinks", () => {
  it("ramène les CTA mail vers la page contact", () => {
    const doc = {
      cta: { label: "Parlons-en", href: "mailto:hello@sujeedesign.com?subject=Un%20projet" },
      hero: { cta: { label: "Voir", href: "/realisations" } },
    };
    expect(contactLinks(doc)).toEqual({
      cta: { label: "Parlons-en", href: "/contact" },
      hero: { cta: { label: "Voir", href: "/realisations" } },
    });
  });

  it("garde l'adresse quand elle est affichée en clair", () => {
    const doc = { email: "hello@sujeedesign.com", label: "mailto:hello@sujeedesign.com" };
    expect(contactLinks(doc)).toEqual(doc);
  });

  it("neutralise un href piloté par la base", () => {
    const doc = {
      a: { href: " javascript:alert(1)" },
      b: { href: "DATA:text/html;base64,PHNjcmlwdD4=" },
      c: { href: "/tarifs" },
    };
    expect(contactLinks(doc)).toEqual({
      a: { href: "/contact" },
      b: { href: "/contact" },
      c: { href: "/tarifs" },
    });
  });

  it("traverse les tableaux et ignore les valeurs nulles", () => {
    const doc = [{ href: "MAILTO:hello@sujeedesign.com" }, null, 3];
    expect(contactLinks(doc)).toEqual([{ href: "/contact" }, null, 3]);
  });
});
