import { z } from "zod";

/**
 * Schémas de contenu.
 *
 * Le contenu vit hors de JSX : une seule source, validée au build. Les pages et, plus tard,
 * l'index de l'assistant IA lisent les mêmes objets.
 */

export const linkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const heroSchema = z.object({
  kicker: z.string().min(1),
  title: z.object({
    first: z.string().min(1),
    highlight: z.string().min(1),
    last: z.string().min(1),
  }),
  lead: z.object({
    text: z.string().min(1),
    strong: z.string().min(1),
  }),
  cta: linkSchema,
  tag: z.string().min(1),
});

export const statSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  text: z.string().min(1),
});

export const caseSchema = z.object({
  id: z.string().min(1),
  index: z.string().min(1),
  meta: z.tuple([z.string(), z.string(), z.string()]),
  title: z.string().min(1),
  tags: z.array(z.string()).min(2),
  barLabel: z.string().min(1),
  ghost: z.string().length(2),
  visual: z.enum(["pack", "sign", "ui"]),
  tone: z.enum(["paper", "signal", "ui"]),
  href: z.string().min(1),
});

export const methodStepSchema = z.object({
  step: z.string().min(1),
  duration: z.string().min(1),
  title: z.string().min(1),
  text: z.string().min(1),
});

export const serviceCardSchema = z.object({
  number: z.string().length(2),
  title: z.string().min(1),
  summary: z.string().min(1),
  href: z.string().min(1),
});

export const homeSchema = z.object({
  hero: heroSchema,
  studio: z.object({
    title: z.array(z.string()).min(2),
    intro: z.string().min(1),
    aside: z.string().min(1),
    statement: z.object({ text: z.string().min(1), emphasis: z.string().min(1) }),
    stats: z.array(statSchema).length(4),
  }),
  cases: z.object({
    title: z.array(z.string()).min(2),
    intro: z.string().min(1),
    aside: linkSchema,
    items: z.array(caseSchema).length(3),
  }),
  method: z.object({
    title: z.string().min(1),
    intro: z.string().min(1),
    aside: z.string().min(1),
    steps: z.array(methodStepSchema).length(3),
  }),
  services: z.object({
    title: z.array(z.string()).min(2),
    intro: z.string().min(1),
    aside: z.string().min(1),
    items: z.array(serviceCardSchema).length(5),
  }),
  cta: z.object({
    text: z.string().min(1),
    action: linkSchema,
  }),
});

export type HomeContent = z.infer<typeof homeSchema>;
