import { isValidElement, type ReactElement, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import CalculateurPage from "@/app/ressources/calculateur-budget-identite/page";
import BriefPage from "@/app/ressources/generateur-brief-identite/page";
import TesterLogoPage from "@/app/ressources/tester-son-logo/page";
import PrixLogoPage from "@/app/guides/prix-logo/page";
import TendancesPage from "@/app/guides/tendances-web-design-2027/page";
import ServicePage from "@/app/services/[slug]/page";
import sitemap from "@/app/sitemap";
import { JsonLd } from "@/components/site/JsonLd";
import { PAGE_UPDATED, SERVICE_UPDATED } from "@/lib/content/freshness";
import { routes, servicePath } from "@/lib/routes";

/**
 * Non-régression du dispositif AEO / `FAQPage`.
 *
 * Le site déclare un `FAQPage` sur chaque page qui affiche une FAQ, et sur cinq
 * d'entre elles une réponse courte « En bref » en tête de page. Ce texte est
 * publié deux fois : à l'écran et dans le JSON-LD. Google attend une
 * correspondance stricte entre les deux ; une retouche de copie faite d'un seul
 * côté casse silencieusement l'éligibilité aux résultats enrichis.
 *
 * Ces tests rendent la page réelle (composant de route + son JSON-LD, sans
 * rendu RSC), puis comparent le graphe au texte visible. Ils échouent donc dès
 * qu'un texte est modifié dans un seul des deux mondes, qu'un bloc `FAQPage`
 * apparaît en double ou que la question AEO perd sa place de tête.
 */

/** Texte comparable : espaces (dont insécables) réduits, bords rognés. */
const clean = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

type AnyElement = ReactElement<Record<string, unknown>>;

/** Parcourt un arbre d'éléments React (pas encore rendus) en profondeur. */
function walk(node: ReactNode, visit: (element: AnyElement) => void): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child as ReactNode, visit);
    return;
  }
  if (!isValidElement(node)) return;
  const element = node as AnyElement;
  visit(element);
  walk(element.props.children as ReactNode, visit);
}

type GraphNode = Record<string, unknown>;

function graphNodes(graphs: readonly unknown[]): GraphNode[] {
  return graphs.flatMap((graph) => {
    const nodes = (graph as { "@graph"?: unknown })["@graph"];
    return Array.isArray(nodes) ? (nodes as GraphNode[]) : [];
  });
}

type FaqNode = {
  "@type"?: string;
  "@id"?: string;
  mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>;
};

type VisibleEntry = { question: string; answer: string; source: string };

type Audit = {
  /** Nombre de balises `application/ld+json` dans la page. */
  blocks: number;
  /** Nombre de nœuds `FAQPage` dans le graphe. */
  faqCount: number;
  faq: FaqNode | undefined;
  entries: Array<{ question: string; answer: string }>;
  visible: VisibleEntry[];
  dateModified: string[];
};

type PageCase = {
  label: string;
  path: string;
  /** La page publie-t-elle un bloc « En bref » en tête ? */
  aeo: boolean;
  load: () => ReactNode | Promise<ReactNode>;
};

const SERVICE_SLUGS = [
  "identite-de-marque",
  "direction-artistique",
  "site-ecommerce",
  "contenu-reseaux",
] as const;

const SERVICE_PAGES: PageCase[] = SERVICE_SLUGS.map((slug) => ({
  label: `fiche service ${slug}`,
  path: servicePath(slug),
  aeo: true,
  load: () => ServicePage({ params: Promise.resolve({ slug }) }),
}));

const PAGES: PageCase[] = [
  ...SERVICE_PAGES,
  {
    label: "guide prix d'un logo",
    path: routes.guidePrixLogo,
    aeo: true,
    load: () => PrixLogoPage(),
  },
  {
    label: "guide tendances web design 2027",
    path: routes.guideTendances2027,
    aeo: true,
    load: () => TendancesPage(),
  },
  {
    label: "calculateur de budget identité",
    path: routes.calculateurBudgetIdentite,
    aeo: false,
    load: () => CalculateurPage(),
  },
  {
    label: "générateur de brief identité",
    path: routes.generateurBriefIdentite,
    aeo: false,
    load: () => BriefPage(),
  },
  {
    label: "test de logo",
    path: routes.testerSonLogo,
    aeo: false,
    load: () => TesterLogoPage(),
  },
];

/** Rend la page, collecte son JSON-LD et le texte visible de sa FAQ. */
async function auditPage(page: PageCase): Promise<Audit> {
  const tree = await page.load();

  const graphs: unknown[] = [];
  let main: AnyElement | undefined;
  walk(tree, (element) => {
    if (element.type === JsonLd) graphs.push(element.props.data);
    if (element.type === "main" && !main) main = element;
  });
  if (!main) throw new Error(`${page.label} : aucun <main> dans l'arbre rendu`);

  const { container } = render(main);

  const nodes = graphNodes(graphs);
  const faqNodes = nodes.filter((node) => node["@type"] === "FAQPage") as FaqNode[];
  const faq = faqNodes[0];
  const entries = (faq?.mainEntity ?? []).map((entry) => ({
    question: clean(entry.name),
    answer: clean(entry.acceptedAnswer?.text),
  }));

  const visible: VisibleEntry[] = [];
  for (const marker of Array.from(container.querySelectorAll(".sec-num"))) {
    if (clean(marker.textContent) !== "En bref") continue;
    const head = marker.parentElement;
    visible.push({
      question: clean(head?.querySelector("h2")?.textContent),
      answer: clean(head?.querySelector("p")?.textContent),
      source: "En bref",
    });
  }
  for (const details of Array.from(container.querySelectorAll("details"))) {
    const answer = details.querySelector(".faqanswer p") ?? details.querySelector("p");
    visible.push({
      question: clean(details.querySelector("summary")?.textContent),
      answer: clean(answer?.textContent),
      source: "accordéon FAQ",
    });
  }

  const dateModified = graphNodes(graphs)
    .map((node) => node["dateModified"])
    .filter((value): value is string => typeof value === "string");

  return { blocks: graphs.length, faqCount: faqNodes.length, faq, entries, visible, dateModified };
}

/** Jour calendaire `AAAA-MM-JJ` d'un instant, vu de Paris (comme la fraîcheur éditoriale). */
const PARIS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dayOf = (value: string | Date): string =>
  PARIS_DAY.format(value instanceof Date ? value : new Date(value));

/** Jour éditorial déclaré pour une route : fiche service ou page statique. */
function declaredDay(path: string): string | undefined {
  const slug = SERVICE_SLUGS.find((candidate) => servicePath(candidate) === path);
  if (slug) return SERVICE_UPDATED[slug];
  return PAGE_UPDATED[path as keyof typeof PAGE_UPDATED];
}

// jsdom n'a pas de back office : on force le repli sur le JSON versionné,
// sinon la fiche service tenterait un `fetch` réseau dans la suite de tests.
beforeAll(() => {
  delete process.env.CONTENT_API_URL;
});

const audit = new Map<string, Audit>();

beforeAll(async () => {
  for (const page of PAGES) audit.set(page.label, await auditPage(page));
}, 60_000);

describe.each(PAGES.map((page) => [page.label, page] as const))("%s", (label, page) => {
  it("déclare un seul bloc FAQPage et une seule balise JSON-LD", () => {
    const result = audit.get(label);
    if (!result) throw new Error(`${label} : page non auditée`);

    expect(result.blocks, `${label} : balises ld+json`).toBe(1);
    expect(result.faq, `${label} : nœud FAQPage`).toBeDefined();
    expect(result.faq?.["@type"], `${label} : @type`).toBe("FAQPage");
    expect(result.faqCount, `${label} : nombre de blocs FAQPage`).toBe(1);
    expect(result.faq?.["@id"], `${label} : @id`).toBe(
      `https://sujeedesign.com${page.path}#faq`,
    );
  });

  it("aligne chaque acceptedAnswer.text sur le texte visible, à l'espacement près", () => {
    const result = audit.get(label);
    if (!result) throw new Error(`${label} : page non auditée`);

    expect(result.entries.length, `${label} : mainEntity vide`).toBeGreaterThan(0);

    for (const entry of result.entries) {
      const shown = result.visible.find((candidate) => candidate.question === entry.question);
      expect(shown, `${label} : question sans texte visible « ${entry.question} »`).toBeDefined();
      expect(shown?.answer, `${label} : réponse divergente pour « ${entry.question} »`).toBe(
        entry.answer,
      );
    }

    // Aucun texte visible ne doit être absent du graphe : une question affichée
    // mais non déclarée est aussi une incohérence AEO.
    expect(
      result.visible.map((entry) => entry.question),
      `${label} : texte visible non déclaré`,
    ).toEqual(result.entries.map((entry) => entry.question));
  });

  it("ne répète aucune question dans le FAQPage", () => {
    const result = audit.get(label);
    if (!result) throw new Error(`${label} : page non auditée`);

    const questions = result.entries.map((entry) => entry.question);
    expect(new Set(questions).size, `${label} : questions dupliquées`).toBe(questions.length);
  });

  it("garde la date de modification cohérente avec la table de fraîcheur", async () => {
    const result = audit.get(label);
    if (!result) throw new Error(`${label} : page non auditée`);

    const entries = await sitemap();
    const entry = entries.find((item) => item.url === `https://sujeedesign.com${page.path}`);
    expect(entry, `${label} : absente du sitemap`).toBeDefined();

    // `dateModified` n'existe que là où un `Article` est déclaré (les guides).
    // Ailleurs, la fraîcheur de la page s'exprime par le `lastmod` du sitemap.
    const expected = declaredDay(page.path);
    for (const value of result.dateModified) {
      expect(dayOf(value), `${label} : dateModified hors table de fraîcheur`).toBe(expected);
    }

    expect(dayOf(entry?.lastModified as Date), `${label} : lastmod du sitemap`).toBe(expected);
  });

  if (page.aeo) {
    it("place la question AEO en tête de mainEntity", () => {
      const result = audit.get(label);
      if (!result) throw new Error(`${label} : page non auditée`);

      const block = result.visible.find((entry) => entry.source === "En bref");
      expect(block, `${label} : bloc « En bref » introuvable`).toBeDefined();
      expect(block?.question.length, `${label} : question AEO vide`).toBeGreaterThan(0);

      const first = result.entries[0];
      expect(first?.question, `${label} : tête de mainEntity`).toBe(block?.question);
      expect(first?.answer, `${label} : réponse AEO`).toBe(block?.answer);
    });
  }
});
