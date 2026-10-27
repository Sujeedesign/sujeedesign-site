import { z } from "zod";
import { CONTACT_EMAIL, routes } from "@/lib/routes";

/**
 * Identité du studio.
 *
 * Source unique pour les métadonnées, le JSON-LD et, plus tard, l'assistant IA.
 */
const siteSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().min(1),
  url: z.string().url(),
  email: z.string().email(),
  tagline: z.string().min(1),
  founder: z.string().min(1),
  areaServed: z.array(z.string()).min(1),
  address: z.object({
    locality: z.string().min(1),
    region: z.string().min(1),
    country: z.string().min(1),
  }),
  socials: z.array(z.object({ label: z.string(), href: z.string().url() })).min(1),
});

export const site = siteSchema.parse({
  name: "Sujee Design",
  legalName: "Sujeepan Sabesan",
  url: "https://sujeedesign.com",
  email: CONTACT_EMAIL,
  tagline: "Votre marque, de A à Z",
  founder: "Sujeepan Sabesan",
  areaServed: ["Cergy", "Paris", "Île-de-France"],
  address: { locality: "Cergy", region: "Île-de-France", country: "FR" },
  socials: [
    { label: "Behance", href: "https://www.behance.net/SujeepanSabesan" },
    { label: "Instagram design", href: "https://www.instagram.com/sujeepan.sabesan.design/" },
    { label: "Instagram IA", href: "https://www.instagram.com/sujeedesign.ai/" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/sujeepan-sabesan/" },
  ],
});

/** JSON-LD injecté dans le layout : un seul professionnel, un seul site. */
export function professionalServiceJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": `${site.url}/#studio`,
    name: site.name,
    url: site.url,
    email: site.email,
    slogan: site.tagline,
    founder: { "@type": "Person", name: site.founder },
    areaServed: site.areaServed,
    address: {
      "@type": "PostalAddress",
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      addressCountry: site.address.country,
    },
    sameAs: site.socials.map((social) => social.href),
    knowsAbout: [
      "Identité de marque",
      "Direction artistique",
      "Site web et e-commerce",
      "Contenu et réseaux sociaux",
      "Agents IA",
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Services",
      itemListElement: [
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Identité de marque" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Direction artistique" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Site et e-commerce" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Contenu et réseaux" } },
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Agents IA" } },
      ],
    },
    mainEntityOfPage: `${site.url}${routes.home}`,
  };
}
