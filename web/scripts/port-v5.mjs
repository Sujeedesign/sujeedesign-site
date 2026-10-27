/**
 * Portage mécanique des pages du thème v5 (HTML statique) vers des composants React.
 *
 * Usage : node scripts/port-v5.mjs page1 page2 ...
 * Les pages sources sont lues dans ../../theme/v5 et les composants écrits dans
 * components/pages/. Le balisage produit est strictement celui du v5, à la seule
 * différence des liens (urls propres) et des chemins d'assets (absolus).
 */
import fs from "node:fs";
import path from "node:path";
import HtmlToJsx from "htmltojsx";

const root = path.resolve(import.meta.dirname, "..");
const themeDir = path.resolve(root, "../theme/v5");
const outDir = path.join(root, "components/pages");

const pageToRoute = {
  "index.html": "/",
  "realisations.html": "/realisations",
  "projet.html": "/realisations/vaasam",
  "services.html": "/services",
  "service-identite.html": "/services/identite-de-marque",
  "service-direction-artistique.html": "/services/direction-artistique",
  "service-site-ecommerce.html": "/services/site-ecommerce",
  "service-contenu.html": "/services/contenu-reseaux",
  "agents-ia.html": "/services/agents-ia",
  "a-propos.html": "/a-propos",
  "mentions-legales.html": "/mentions-legales",
};

const names = {
  "realisations.html": "Realisations",
  "projet.html": "Projet",
  "services.html": "Services",
  "service-identite.html": "ServiceIdentite",
  "service-direction-artistique.html": "ServiceDirectionArtistique",
  "service-site-ecommerce.html": "ServiceSiteEcommerce",
  "service-contenu.html": "ServiceContenu",
  "agents-ia.html": "AgentsIa",
  "a-propos.html": "APropos",
  "mentions-legales.html": "MentionsLegales",
};

function rewrite(html) {
  let out = html;
  // Liens internes -> urls propres
  for (const [file, route] of Object.entries(pageToRoute)) {
    out = out.replaceAll(`href="${file}#top"`, `href="${route}#top"`);
    out = out.replaceAll(`href="${file}"`, `href="${route}"`);
  }
  // Assets -> chemins absolus servis par /public
  out = out.replaceAll('src="assets/', 'src="/assets/');
  out = out.replaceAll('href="assets/', 'href="/assets/');
  // Attribut booléen implicite `alt` : le v5 l'écrit sans valeur, JSX exige une chaîne
  return out;
}

function extractMain(html) {
  const start = html.indexOf('<main id="main">');
  const end = html.lastIndexOf("</main>");
  if (start === -1 || end === -1) throw new Error("main introuvable");
  return html.slice(start + '<main id="main">'.length, end);
}

function extractMeta(html) {
  const title = (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  const description =
    (html.match(/<meta name="description" content="([\s\S]*?)">/) || [])[1] || "";
  return { title: title.trim(), description: description.trim() };
}

const converter = new HtmlToJsx({ createClass: false });

// Eléments SVG que htmltojsx met en minuscules et que React attend en camelCase
const svgTags = {
  animatemotion: "animateMotion",
  animatetransform: "animateTransform",
  clippath: "clipPath",
  lineargradient: "linearGradient",
  radialgradient: "radialGradient",
  textpath: "textPath",
  fegaussianblur: "feGaussianBlur",
  femerge: "feMerge",
  femergenode: "feMergeNode",
  foreignobject: "foreignObject",
};

function fixSvg(jsx) {
  // htmltojsx reduit alt="" a un attribut booleen : JSX exige une chaine
  let out = jsx.replace(/ alt(?=[\s>])/g, ' alt=""');
  for (const [lower, camel] of Object.entries(svgTags)) {
    out = out.replaceAll(`<${lower}`, `<${camel}`).replaceAll(`</${lower}`, `</${camel}`);
  }
  return out;
}

for (const page of process.argv.slice(2)) {
  const html = fs.readFileSync(path.join(themeDir, page), "utf8");
  const meta = extractMeta(html);
  const body = rewrite(extractMain(html));
  const jsx = fixSvg(converter.convert(body));
  const name = names[page];
  const file = path.join(outDir, `${name}.tsx`);
  fs.writeFileSync(
    file,
    `/** Portage du v5 : ${page}. Balisage d'origine, liens en urls propres. */
export const pageMeta = ${JSON.stringify(meta, null, 2)};

export function ${name}() {
  return (
    <>
${jsx}
    </>
  );
}
`,
  );
  console.log(`${page} -> ${path.relative(root, file)} (${jsx.length} car.)`);
}
