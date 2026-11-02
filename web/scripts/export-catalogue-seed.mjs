// Génère app/data/catalogue_seed.json depuis web/content/projects.ts
// (source statique historique). Insertion seule côté serveur : ce fichier sert
// à ne perdre aucune fiche existante lors de la bascule vers la base.
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const here = path.resolve("/opt/data/sujeedesign-site");
const src = path.join(here, "web/content/projects.ts");

const out = await build({
  entryPoints: [src],
  bundle: true,
  format: "cjs",
  platform: "node",
  write: false,
  loader: { ".ts": "ts" },
});
const code = out.outputFiles[0].text;
const mod = { exports: {} };
new Function("module", "exports", "require", code)(mod, mod.exports, () => ({}));
const { projects } = mod.exports;

const rows = projects.map((p, i) => {
  // La couverture reste distincte de la galerie : c'est ce que faisaient les
  // fiches statiques, le rendu du site ne doit pas bouger d'un pixel.
  const images = [...p.images];
  return {
    slug: p.slug,
    nom: p.name,
    client: p.client ?? "",
    annee: p.year ?? "",
    ville: p.city ?? "",
    pitch: p.pitch ?? "",
    scope: p.scope ?? "",
    duree: p.duration ?? "",
    ton: p.tone ?? "paper",
    disciplines: p.disciplines ?? [],
    tags: p.tags ?? [],
    images,
    cover: p.cover ?? {},
    sections: p.sections ?? [],
    results: p.results ?? [],
    position: (i + 1) * 10,
  };
});

const target = path.join(here, "app/data/catalogue_seed.json");

// Les prestations aussi : /admin/prestations partait vide alors que le site
// affiche déjà ces cinq offres en dur. Même règle, insertion seule.
const services = JSON.parse(
  fs.readFileSync(path.join(here, "web/content/services.json"), "utf8"),
);
const prestations = (services.prestations?.rows ?? []).map((r, i) => ({
  slug: String(r.href ?? "").split("/").filter(Boolean).pop() ?? `prestation-${i + 1}`,
  nom: r.title ?? "",
  accroche: r.summary ?? "",
  description: "",
  prix: "",
  duree: r.dur ?? "",
  livrables: r.tags ?? [],
  statut: "publie",
  position: (i + 1) * 10,
}));

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(
  target,
  JSON.stringify({ version: 2, projets: rows, prestations }, null, 2) + "\n",
);
console.log(
  `${rows.length} projets et ${prestations.length} prestations écrits dans ${target}`,
);
